<div class="select gradient-blue transition-200ms">
	<div>
		<span class="label">{{label}}</span>
		<ul>
			{{#options}}
			<li data-value="{{value}}">{{title}}</li>
			{{/options}}
		</ul>
	</div>
	<input type="text" class="input-basic">
	<span class="selected"></span>
</div>