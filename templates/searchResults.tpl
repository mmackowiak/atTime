<div class="results">
	<span class="resultType">Projekty</span>
	<ul class="result" data-collection="projects">
		{{#projects}}<li data-id="{{id}}">{{title}}</li>{{/projects}}
		{{^projects}}<li class="noResults">Brak wyników.</li>{{/projects}}
	</ul>
	<hr />
	<span class="resultType">Zadania</span>
	<ul class="result" data-collection="tasks">
		{{#tasks}}<li data-id="{{id}}">{{title}}</li>{{/tasks}}
		{{^tasks}}<li class="noResults">Brak wyników.</li>{{/tasks}}
	</ul>
	<hr />
	<span class="resultType">Wpisy</span>
	<ul class="result" data-collection="entries">
		{{#entries}}<li data-id="{{id}}">{{title}}</li>{{/entries}}
		{{^entries}}<li class="noResults">Brak wyników.</li>{{/entries}}
	</ul>
</div>
