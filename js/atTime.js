"use strict";

var q = $,
	messages = Messages(),
	store = Store(),
	templates = Templates(),
	toInt = function(x) { return parseInt(x, 10); },
	isSet = function(v) { return typeof v !== 'undefined' },
	isEmpty = function(o) { return Object.keys(o).length === 0; },
	isDate = function(date) {
	   	var pattern = /^([0-9]{2})\/([0-9]{2})\/([0-9]{4})$/,
			matches = pattern.exec(date),
			date0;
		if(!matches) return false;
		date0 = new Date(matches[3], (matches[2]-1), matches[1]);
	  	return ((date0.getMonth() == (matches[2]-1)) &&
	           (date0.getDate() == matches[1]) &&
	           (date0.getFullYear() == matches[3]));
	},
	clone = function(o){
		var target = {};
		for (var i in o) if (o.hasOwnProperty(i))
			target[i] = o[i];
		return target;
	};

function Messages() {
	var _cache = {},
		publish = function(m, args) {
			_cache[m] && _cache[m].forEach(function(e) {
				e.apply(null, args || []);
			});
		},
		subscribe = function(list) {
			for (var message in list) if (list.hasOwnProperty(message)) {
				if(!_cache[message])
					_cache[message] = [];
				_cache[message].push(list[message]);
			}
		},
		unsubscribe = function(message) {
			_cache[message] && (_cache[message] = []);
		};

	return {
		publish: publish,
		subscribe: subscribe,
		unsubscribe: unsubscribe
	};
}

function Store() {
	var get = function(key) {
			var value = localStorage.getItem(key),
				result = JSON.parse(value);
			return value === null 
				? false 
				: !isSet(result._textNode) ? result : result._textNode;
		}, 
		set = function(key, value) {
			localStorage.setItem(key, JSON.stringify(
				typeof value === 'object' ? value : {_textNode: value}
			));
		},
		remove = function(key) {
			localStorage.removeItem(key);
		},
		size = function() {
			return localStorage.length;
		};
	
	return {
		set: set,
		get: get,
		remove: remove,
		size: size
	};
}

function Templates() {
	var _templates = {},
		_path = 'templates/',
		_fileType = '.tpl',
		_stack = {},
		loadTemplate = function(template) {
			q.ajax({
			    url: _path + template + _fileType,
			 	type: 'get',
			 	dataType: 'html',
			  	success: function(response) {
			  		var i;
			  		_templates[template] = response;
			  		
			    	for(i = _stack[template].length-1; i >= 0 ; i--) 
			    		_stack[template][i]();
			    	delete _stack[template];
			    },
			    error: function() { }
			});
		},
		render = function(template, view, callback) {
			var output = function() { callback(Mustache.render(_templates[template], view)); };
			if(isSet(_templates[template])) output();
			else {
				if(!isSet(_stack[template]))
					_stack[template] = [];

				_stack[template].push(output);

				if(_stack[template].length-1 === 0)
					loadTemplate(template);
			}
		};

	return {
		loadTemplate: loadTemplate,
		render: render
	};
}

function Model() {
	var _data = {},
		_structure = {
			projects: ['title'],
			tasks: ['ascendantID', 'title'],
			entries: ['ascendantID', 'comment', 'startDate', 'startHour', 'stopDate', 'stopHour', 'duration']
		},
		_relationships = ['projects', 'tasks', 'entries'],
		_fieldTypes = {
			'text': ['title', 'comment'],
			'date': ['startDate', 'stopDate'],
			'hour': ['startHour', 'stopHour']
		},
		_syncing = true,
		_initialize = function() {
			for (var i in _structure) if (_structure.hasOwnProperty(i)) {
				_data[i] = store.get(i) || {};
			}
			_sync();
		},
		_id = function(object) {
            var id = 0;

            for (var i in object) if (object.hasOwnProperty(i)) {
                id = toInt(i) > id ? toInt(i) : id;
            }

            return id;
        },
        _ascendantCollection = function(collection) {
        	return _relationships[_relationships.indexOf(collection)-1];
        },
        _descendantCollection = function(collection) {
        	return _relationships[_relationships.indexOf(collection)+1];
        },
        _descendants = function(collection, id, isCurrent) {
        	collection = isSet(isCurrent) ? collection : _descendantCollection(collection);

			var results = {},
				descendants = _data[collection];
			
			if(isSet(descendants)) {
				for (var i in descendants) if (descendants.hasOwnProperty(i)) {
					if(descendants[i].ascendantID === toInt(id)) {
						results[i] = true;
					}
				}
			}
			
			return results;
		},
		_filter = function(input, collection) {
			var output = {},
				structureSet = _structure[collection];

			for (var i in input) if (input.hasOwnProperty(i)) {
				if(structureSet.indexOf(i) > -1) 
					output[i] = input[i];
			}
			
			return output;
		},
		_fieldType = function(field) {
			var result;

			for (var i in _fieldTypes) if (_fieldTypes.hasOwnProperty(i)) {
				result = _fieldTypes[i].indexOf(field);
				if(result > -1) return i;
			}
		},
		_validate = function(collection, input) {
			var errors = {},
				value,
				hourPattern = /^([0-1][0-9]|2[0-3])[:][0-5][0-9]$/;

			for (var i in input) if (input.hasOwnProperty(i)) {
				value = input[i];
				if(value === '') {
					errors[i] = 'Pole nie może być puste.';
				}
				else {
					switch(_fieldType(i)) {
						case 'date': 
							if(!isDate(value))
								errors[i] = 'Pole powinno zawierać datę.';
							break;
						case 'hour':
							if(!hourPattern.test(value))
								errors[i] = 'Pole powinno zawierać godzinę.';
							break;
					}
				}
			}
			messages.publish('/form/valid', [collection, errors]);

			return isEmpty(errors);
		},
		_sync = function() {
			setTimeout(function() {
				if(_syncing)
					for (var i in _data) if (_data.hasOwnProperty(i)) {
					    store.set(i, _data[i]);
					}
				_sync();
			}, 10000);
		},
		_duration = function(input) {
			var format = 'DD/MM/YYYY HH:mm',
				start = moment(input['startDate']+' '+input['startHour'], format),
				stop = moment(input['stopDate']+' '+input['stopHour'], format),
				duration = stop.diff(start);

			input['duration'] = Math.round(duration/(1000*60));
		},
		_clock = function(collection, ascendantID) {
			var duration = 0,
				items = _descendants(collection, ascendantID, true),
				item, hours, minutes;

			for (var id in items) if (items.hasOwnProperty(id)) {
				item = _data[collection][id];
				if(isSet(item['duration']) && item['duration'] >= 0)
					duration += item['duration'];
			}
			hours = Math.floor(duration/60);
			minutes = duration - hours*60;
			
			messages.publish('/clock/render', [[Math.floor(hours/10), hours%10, Math.floor(minutes/10), minutes%10]]);
		},
		get = function(collection, id) {
			var item = _data[collection][id];
			
			if(isSet(item)) {
				messages.publish('/items/render', [collection, id, item, _descendants(collection, id)]);
			}
		},
		getList = function(collection, ascendantID) {
			var currentCollection = collection, 
				list, item;

			if(!isSet(ascendantID))
				list = _data[collection];
			else {
				list = _descendants(collection, ascendantID);
				currentCollection = _descendantCollection(collection);
			}

			messages.publish('/items/renderList', [
				currentCollection, 
				ascendantID, 
				_data[collection][ascendantID]
			]);

			if(currentCollection === 'entries')
				_clock(currentCollection, ascendantID);
			
			for (var id in list) if (list.hasOwnProperty(id)) {
				item = _data[currentCollection][id];
				if(isSet(item)) 
					messages.publish('/items/render', [currentCollection, id, item, _descendants(currentCollection, id)]);
			}			
		},
		create = function(collection, input) {
			var id = _id(_data[collection])+1,
				filteredInput = _filter(input, collection),
				ascendantID;

			if(!isSet(_data[collection][id]) && _validate(collection, filteredInput)) {
				_data[collection][id] = filteredInput;
				
				messages.publish('/items/render', [collection, id, _data[collection][id], _descendants(collection, id)]);
					
				ascendantID = _data[collection][id]['ascendantID'];
				if(isSet(ascendantID))
					messages.publish('/items/get', [_ascendantCollection(collection), ascendantID]);

				if(collection === 'entries') {
					_duration(_data[collection][id]);
					_clock(collection, ascendantID);
				}
			}
		},
		update = function(collection, id, input) {
			var item = _data[collection][id],
				filteredInput = _filter(input, collection),
				ascendantID;

			if(isSet(item) && _validate(collection, filteredInput)) {
				for (var i in filteredInput) if (filteredInput.hasOwnProperty(i)) {
					_data[collection][id][i] = filteredInput[i];
				}

				messages.publish('/items/render', [collection, id, item, _descendants(collection, id)]);

				ascendantID = _data[collection][id]['ascendantID'];
				if(isSet(ascendantID))
					messages.publish('/items/get', [_ascendantCollection(collection), ascendantID]);

				if(collection === 'entries') {
					_duration(_data[collection][id]);
					_clock(collection, ascendantID);
				}
			}
		},
		remove = function(collection, id) {
			var item = _data[collection][id];

			if(isSet(item) && delete _data[collection][id]) 
				messages.publish('/items/render', [collection, id, item, _descendants(collection, id)]);
		},
		search = function(phrase) {
			var item, title, comment, results = {};

			phrase = phrase.toLowerCase();
			if(phrase.length > 2) {
				for (var collection in _data) if (_data.hasOwnProperty(collection)) {
					results[collection] = [];
					for (var id in _data[collection]) if (_data[collection].hasOwnProperty(id)) {
						item = _data[collection][id];
						comment = isSet(item.comment) ? item.comment : '';
						title = isSet(item.title) ? item.title : '';
						if((title.toLowerCase().indexOf(phrase) !== -1 || comment.toLowerCase().indexOf(phrase) !== -1) && phrase.length > 0) {
							results[collection].push({
								id: id,
								title: title || comment
							});
						}
					}
				}
			} else {
				results = false;
			}
			messages.publish('/search/results', [results]);
		};

	_initialize();

	messages.subscribe({
		'/items/get': get,
		'/items/getList': getList,
		'/items/create': create,
		'/items/update': update,
		'/items/remove': remove,
		'/search/query': search
	});
}

function View() {
	var _document = q(document),
		_lists = q('#lists'),
		_listsItems = {
			'projects': _lists.children('#projects'),
			'tasks': _lists.children('#tasks'),
			'entries': _lists.children('#entries')
		},
		_navigationItems = q('#navigation > li'),
		_timer = _navigationItems.filter('#timer'),
		_timerState = {

		},
		_content = q('#content'),
		_searchInput = q('#navigation .search input[type="text"]'),
		_initialize = function() {
			bindEvents();
		},
		_fetchData = function(form) {
			var data = {};

			form.find('[name]').each(function(i, e) {
				var this0 = q(e);
				data[this0.attr('name')] = this0.val();
			});

			return data;
		},
		bindEvents = function() {
			_searchInput.on('keyup', function(e) {
				messages.publish('/search/query', [q(this).val()]);
			});
			_navigationItems.on('click', function(e) {
				if (e.target !== e.currentTarget) 
					return;

				var this0 = q(this);

				if(this0.hasClass('visible')) 
					focusLists();
				else {
					_navigationItems.removeClass('visible');
					_lists.addClass('focusOff');
					this0.addClass('visible');
				}
			});
			_content.on('click', focusLists);
			_lists.find('article > button[class*=add]').on('click', function(e) {
				var this0 = q(this);
				formVisibility(this0.siblings('.form'), undefined, this0);
			});
			_navigationItems.find('.select .label').on('click', function(e) {
				q(this).parent().toggleClass('visible');
			});
			q('#lists .form .confirm').on('click', function(e) {
				var form = q(this).parents('.form'),
					collection = form.data('collection'),
					id = toInt(form.data('id')),
					data = _fetchData(form),
					ascendantID = toInt(_listsItems[collection].data('ascendant'));
				
				if(isSet(ascendantID))
					data['ascendantID'] = ascendantID;
				
				if(id > 0 && !isNaN(id)) {
					messages.publish('/items/update', [collection, id, data]);
				} else { 
					messages.publish('/items/create', [collection, data]);
				}
			});
			q('#lists .form .cancel').on('click', function(e) {
				formVisibility(q(this).parents('.form'), false);
			});
			_document.on('click', '.search .result li:not(.noResults)', function() {
				var this0 = q(this);
				messages.publish('/items/focus', [
					this0.parent().data('collection'), 
					this0.data('id')
				]);
			});
			_document.on('click', '.formError', function() {
				q(this).remove();
			});
			_document.on('click', '#projects .list li, #tasks .list  li', function() {
				var this0 = q(this),
					collection = this0.parents('article').attr('id');
				this0.siblings().removeClass('current');
				this0.addClass('current');
				messages.publish('/items/getList', [collection, this0.data('id')]);
			});
			_timer
				.on('click', '.select div ul li', function() {
					var this0 = q(this),
						parent = this0.parents('.select'),
						selection = parent.find('.selected');
					parent.children(':not(.selected)').removeClass('visible').addClass('hidden');
					selection.text(this0.text()).data('value', this0.attr('data-value'));
					_timer.triggerHandler(parent.parent().hasClass('project') ? 'projectSelected' : 'taskSelected');
				})
				.on('click', '.select .selected', function() {
					var this0 = q(this);
					this0.siblings('div').removeClass('hidden').addClass('visible');
				})
				.on('projectSelected', function() {
					_timer.find('.steps').removeClass('chooseProject').addClass('chooseTask');
				})
				.on('taskSelected', function() {

				});
		},
		insertItem = function() {

		},
		ready = function() {
			setTimeout(function() {
				var splashScreen = q('#splashScreen');
				splashScreen.addClass('hidden');
				setTimeout(function() {
					splashScreen.remove();
				}, 550);
			}, /*1500*/ 1);
		},
		renderItem = function(collection, id, data, descendants) {
			var parent = _listsItems[collection].find('.list'),
				item = parent.children('[data-id="'+id+'"]'),
				view = clone(data);
				
			if(isSet(view)) {
				view['descendants'] = Object.keys(descendants).length;
				view['id'] = id;
				templates.render(collection+'Item', view, function(html) {
					if(item.length > 0) {
						item.after(html);
						item.remove();
					} else {
						parent.append(html);
					}
				});
			} else {
				item.addClass('modified');
				setTimeout(function() { item.remove(); }, 350);
			}
		},
		focusItem = function(collection, id) {
			focusLists();
			showList(collection);
			// list create
		},
		renderList = function(collection, ascendantID, ascendant) {
			var list = _listsItems[collection];

			showList(collection);
			formVisibility(list.find('.form'), false);
			list.find('.list li').remove();
			if(isSet(ascendantID)) {
				list.data('ascendant', ascendantID);
				list.find('h1').text(ascendant['title']);
			}
		},
		focusLists = function() {
			_navigationItems.removeClass('visible');
			_lists.removeClass('focusOff');
		},
		showList = function(collection) {
			var stop = false;

			_lists.children('article').each(function(i, e) {
				var this0 = q(e),
					currentCollection = this0.attr('id');
				if(!stop) {
					this0.addClass('visible');
				} else { 
					this0.removeClass('visible');
				}
				if(currentCollection === collection) stop = true;
			});
		},
		renderClock = function(clock) {
			if(isSet(clock)) {
				_content.find('.clock .hour, .clock .minute').each(function(i) {
					q(this).text(clock[i]);
				});
			}
		},
		searchResults = function(results) {
			var box = q('#navigation .search .box');

			box.children('.results').remove();
			if(results !== false) {
				templates.render('searchResults', results, function(html) {
					box.append(html);
				});
			}
		},
		formVisibility = function(form, visible, button) {
			var buttonElement = isSet(button) ? button : form.siblings('button[class*=add]');
			if(!isSet(visible)) {
				buttonElement.toggleClass('active');
				form.toggleClass('visible');
			} else if(visible) {
				buttonElement.addClass('active');
				form.addClass('visible');
			} else {
				buttonElement.removeClass('active');
				form.removeClass('visible');
			}
			form.find('input, textarea').val('');
			form.find('.formError').remove();
		},
		validForm = function(collection, errors) {
			var form = q('#'+collection+' .form');

			form.find('.formError').remove();
			if(isEmpty(errors)) {
				formVisibility(form, false);
			} else {
				for (var error in errors) if (errors.hasOwnProperty(error)) {
					(function(error, data) { 
						templates.render('formError', data, function(html) {
							var element = q(html),
								input = form.find('[name='+error+']'),
								offset = input.offset(),
								parentOffset = input.parents('.form').offset();
							element.css({
								'top': offset.top-parentOffset.top+offset.height,
								'left': offset.left-parentOffset.left
							});
							form.append(element);
						});
					}) (error, {'field': error,'content': errors[error]});
				}
			}
		};

	_initialize();

	messages.subscribe({
		'/app/ready': ready,
		'/search/results': searchResults,
		'/items/render': renderItem,
		'/items/renderList': renderList,
		'/items/focus': focusItem,
		'/clock/render': renderClock,
		'/form/valid': validForm
	});
}

function Controller() {
	var _channels = {},
		_initialize = function() {
			q(window).on('onpopstate', function(event) {
				var state = event.state;
			});
		},
		build = function() {
			messages.publish('/items/getList', ['projects']);
			//messages.publish('/app/ready');
		};
	
	_initialize();

	return {
		build: build
	};
}

q(function() {
	var controller = Controller(),
		model = Model(),
		view = View();

	controller.build();
});

// scroll + daty
// timer
// wybór wyniku wyszukiwania + highlight
// edytuj/usuń

