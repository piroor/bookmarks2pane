(function() {
	var root = document.getElementById('bookmarksPanel');

	if (nsPreferences.getBoolPref('bookmarks2pane.enabled')) {
		root.setAttribute('panesCount', '2');
	}
	else {
		root.removeAttribute('panesCount');
	}
})();



var Bookmarks2PaneService = {

	get isPlaces()
	{
		return 'SidebarUtils' in window;
	},

	get shouldOpenOnlyOneTree()
	{
		return nsPreferences.getBoolPref('bookmarks2pane.open_only_one_tree');
	},

	get shouldOpenNewTab()
	{
		return nsPreferences.getBoolPref('bookmarks2pane.open_new_tab_always');
	},

	doingSearch : false,

	init : function()
	{
		window.removeEventListener('load', this, false);
		window.addEventListener('unload', this, false);

		this.mainTree        = document.getElementById('bookmarks-view');
		this.contentLabel    = document.getElementById('bookmarks-content-label');
		this.contentLabelBox = document.getElementById('bookmarks-content-label-box');
		this.dustbox         = document.getElementById('bookmarks-dustbox');
		this.splitter        = document.getElementById('bookmarks-panes-splitter');

		this.currentTree = this.mainTree;

		this.mainTree.addEventListener('click', this, false);
		this.mainTree.addEventListener('keypress', this, false);
		this.mainTree.addEventListener('Bookmarks2PaneOnFolderSelect', this, false);

		if (this.isPlaces) { // Firefox 3
			document.getElementById('bookmarks-content-view').setAttribute('collapsed', true);
			this.contentTree = document.getElementById('places-content-view');
			this.mainTree.addEventListener('select', this, false);
			this.contentTree.addEventListener('select', this, false);
			this.initPlaces();
		}
		else { // Firefox 2
			document.getElementById('places-content-view').setAttribute('collapsed', true);
			this.contentTree = document.getElementById('bookmarks-content-view');
			this.overrideTree(this.mainTree, 'main');
			this.overrideTree(this.contentTree, 'content');
			window.setTimeout('Bookmarks2PaneService.delayedInitBookmarks()', 0);
		}
		this.contentTree.removeAttribute('collapsed', true);

		this.hackForOtherExtensions();
	},

	destroy : function()
	{
		window.removeEventListener('unload', this, false);

		this.mainTree.removeEventListener('click', this, false);
		this.mainTree.removeEventListener('keypress', this, false);
		this.mainTree.removeEventListener('Bookmarks2PaneOnFolderSelect', this, false);

		if (this.isPlaces) {
			this.mainTree.removeEventListener('select', this, false);
			this.contentTree.removeEventListener('select', this, false);
		}
	},


	handleEvent : function(aEvent)
	{
		switch (aEvent.type)
		{
			case 'select': // for Firefox 3
				var tree = aEvent.currentTarget;
				this.currentTree = tree;

				var event = document.createEvent('Events');
				event.initEvent('Bookmarks2PaneOnFolderSelect', false, true);
				event.targetQuery = 'selection';
				tree.dispatchEvent(event);
				break;

			case 'click':
				this.onToggleOpenState(aEvent);
				break;

			case 'keypress':
				this.onToggleOpenStateKey(aEvent);
				break;

			case 'Bookmarks2PaneOnFolderSelect':
				this.onTargetChange(aEvent);
				break;

			case 'load':
				this.init();
				break;

			case 'unload':
				this.destroy();
				break;
		}
	},

	onToggleOpenStateKey : function(aEvent)
	{
		if (aEvent.keyCode == 13)
			Bookmarks2PaneService.onToggleOpenState(aEvent);
	},

	// from BX (http://tkm.s31.xrea.com/xul/bx.shtml, made by plus7)
	onToggleOpenState: function (aEvent)
	{
		if (!Bookmarks2PaneService.shouldOpenOnlyOneTree) return;

		var tree = Bookmarks2PaneService.currentTree;
		var view = tree.treeBoxObject.view;

		var row = {};
		var col = {};
		var obj = {};
		tree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, col, obj);
		row = row.value;

		if (/*row == -1 ||*/ aEvent.type != 'keypress' && obj.value == 'twisty') return;


		if (aEvent.type != 'keypress' && aEvent.button != 0){
			return;
		}
		var currentIndex = tree.currentIndex;
		if(!view.isContainer(currentIndex)){
			return;
		}
		var firstVisibleRow = tree.treeBoxObject.getFirstVisibleRow();
		if (
			aEvent.type != 'keypress' &&
			view.isContainer(currentIndex) &&
			(
				!view.isContainerOpen(currentIndex) ||
				(
					tree.lastIndex !== void(0) &&
					tree.lastIndex == currentIndex
				)
			)
			)
			view.toggleOpenState(currentIndex);
		var rowCount = tree.treeBoxObject.view.rowCount;
		var arrParent = new Array();
		var tmp = currentIndex;
		while (tmp != -1)
		{
			arrParent.push(tmp);
			tmp = view.getParentIndex(tmp);
		}
		arrParent.reverse();
		for (var i = rowCount-1; i >= 0; i--)
		{//コンテナでかつopenでかつ現在選択されているものの親でない
			if (arrParent[arrParent.length-1] == i){
				arrParent.pop();
			}
			else {
				if (view.isContainer(i) && view.isContainerOpen(i)){
						view.toggleOpenState(i);
				}
			}
		}
		var distance = tree.currentIndex - (currentIndex - firstVisibleRow);
		tree.treeBoxObject.scrollToRow(distance >= 0 ? distance : 0);
		aEvent.preventDefault();

		tree.lastIndex = currentIndex;
	},

	onTargetChange : function(aEvent)
	{
		if (this.isPlaces)
			this.onTargetChangePlaces(aEvent);
		else
			this.onTargetChangeBookmarks(aEvent);
	},
	onTargetChangePlaces : function(aEvent)
	{
		var tree = aEvent.currentTarget;
		if (aEvent.targetQuery == 'selection') {
			switch (tree.selectedNode.type)
			{
				case Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER:
				case Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER_SHORTCUT:
					this.contentTree.place = 'place:queryType=1&folder=' + tree.selectedNode.folderItemId;
					break;
				case Ci.nsINavHistoryResultNode.RESULT_TYPE_QUERY:
				case Ci.nsINavHistoryResultNode.RESULT_TYPE_DYNAMIC_CONTAINER:
					this.contentTree.place = 'place:queryType=1&folder=' + tree.selectedNode.uri;
					break;
				default:
					return;
			}
			this.contentLabel.value = tree.selectedNode.title;
			nsPreferences.setUnicharPref('bookmarks2pane.last_selected_title', this.contentLabel.value);
			nsPreferences.setUnicharPref('bookmarks2pane.last_selected_folder', this.contentTree.place);
			window.setTimeout(this.onTargetChangeCallback, 0);
		}
		else {
			if (!aEvent.targetQuery) {
				if (this.lastTitle) {
					this.contentLabel.value = this.lastTitle;
					this.lastTitle = '';
				}
				this.showHideForSearch(true);
			}
			else {
				this.lastTitle = this.contentLabel.value;
				this.contentLabel.value = '';
				this.showHideForSearch(false);
			}
		}
	},
	onTargetChangeBookmarks : function(aEvent)
	{
		var tree = this.contentTree;
		if (aEvent.targetQuery == 'selection') {
			Bookmarks2PaneService.showHideForSearch(true);

			var selection = this.mainTree._selection;
			tree.setAttribute('ref', selection.item[0].Value);
			tree.tree.setAttribute('ref', selection.item[0].Value);
			tree.treeBuilder.rebuild();

			this.contentLabel.value = BookmarksUtils.getProperty(selection.item[0], 'http://home.netscape.com/NC-rdf#Name');

			nsPreferences.setUnicharPref('bookmarks2pane.last_selected_folder', selection.item[0].Value);

			window.setTimeout(this.onTargetChangeCallback, 0);
		}
		else {
			if (!aEvent.targetQuery) {
				this.doingSearch = false;
				tree.setAttribute('ref', tree.originalRef);
				tree.tree.setAttribute('ref', tree.originalRef);
				this.contentLabel.value = BookmarksUtils.getProperty(RDF.GetResource(tree.originalRef), 'http://home.netscape.com/NC-rdf#Name');

				this.showHideForSearch(true);
			}
			else {
				this.doingSearch = true;
				if (!tree.originalRef) {
					tree.originalRef = tree.getAttribute('ref');
				}
				tree.setAttribute('ref', aEvent.targetQuery);
				tree.tree.setAttribute('ref', aEvent.targetQuery);
				this.contentLabel.value = '';

				this.showHideForSearch(false);
			}
		}
	},
	onTargetChangeCallback : function()
	{
		Bookmarks2PaneService.contentTree.treeBoxObject.scrollToRow(0);
	},


	createSearchEvent : function(aInput)
	{
		var event = document.createEvent('Events');
		event.initEvent('Bookmarks2PaneOnFolderSelect', false, true);

		if (!aInput) {
			event.targetQuery = null;
		}
		else {
			var match = 'Name';
			if ('gBooxSearchIn' in window) { // hack for Boox
				switch (gBooxSearchIn)
				{
					case 'url':         match = 'URL';         break;
					case 'keywords':    match = 'ShortcutURL'; break;
					case 'description': match = 'Description'; break;
					case 'title':
					default:
						break;
				}
			}
			event.targetQuery = 'find:datasource=rdf:bookmarks&match=http://home.netscape.com/NC-rdf#'+match+'&method=contains&text=' + escape(aInput);
		}

		return event;
	},




	// Places

	initPlaces : function()
	{
		eval('PlacesTreeView.prototype._buildVisibleSection = '+
			PlacesTreeView.prototype._buildVisibleSection.toSource().replace(
				'var curChildType = curChild.type;',
				[
				'$&',
				'if (',
					'(',
						'this.selection &&',
						'this.selection.tree &&',
						'curChildType != Ci.nsINavHistoryResultNode.RESULT_TYPE_DYNAMIC_CONTAINER &&',
						'curChildType != Ci.nsINavHistoryResultNode.RESULT_TYPE_QUERY &&',
						'curChildType != Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER &&',
						'curChildType != Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER_SHORTCUT',
					') ?',
						'(',
							'this.selection.tree.element == Bookmarks2PaneService.mainTree &&',
							'!Bookmarks2PaneService.doingSearch',
						') :',
						'(',
							'this.selection.tree.element == Bookmarks2PaneService.contentTree/* &&',
							'curChild.parent.folderItemId != aContainer.folderItemId*/',
						')',
					') {',
					'continue;',
				'}'
				].join('')
			)
		);
		init();

		eval('window.searchBookmarks = '+
			window.searchBookmarks.toSource().replace(
				'{',
				'$& Bookmarks2PaneService.doingSearch = aSearchString ? true : false ;'
			).replace(
				/(\}\)?)$/,
				[
				'Bookmarks2PaneService.mainTree.dispatchEvent(Bookmarks2PaneService.createSearchEvent(aSearchString));',
				'$1'
				].join('')
			)
		);

		var lastPlace = nsPreferences.copyUnicharPref('bookmarks2pane.last_selected_folder') || '';
		if (lastPlace.indexOf('place:') == 0) {
			this.contentLabel.value = nsPreferences.copyUnicharPref('bookmarks2pane.last_selected_title') || '';
			this.contentTree.place = lastPlace;
		}
	},



	// Bookmarks (RDF based)

	delayedInitBookmarks : function()
	{
		var lastRef = nsPreferences.copyUnicharPref('bookmarks2pane.last_selected_folder') || 'rdf:null';
		if (lastRef != 'rdf:null') {
			this.contentTree.setAttribute('ref', lastRef);
			this.contentTree.tree.setAttribute('ref', lastRef);
			this.contentTree.treeBuilder.rebuild();
			this.contentLabel.value = BookmarksUtils.getProperty(RDF.GetResource(lastRef), 'http://home.netscape.com/NC-rdf#Name');
		}

		var newOpenItemClick = '$1; if (Bookmarks2PaneService.shouldOpenNewTab) { browserTarget = (browserTarget == "current") ? "tab" : (browserTarget == "tab") ? "current" : browserTarget  ;};';
		eval(
			'this.mainTree.openItemClick = '+
			this.mainTree.openItemClick.toSource().replace(
				/(whereToOpenLink\(aEvent\))/,
				newOpenItemClick
			)
		);
		eval(
			'this.mainTree.openItemKey = '+
			this.mainTree.openItemKey.toSource().replace(
				/(['"])current['"]/,
				'(Bookmarks2PaneService.shouldOpenNewTab ? $1tab$1 : $1current$1 )'
			)
		);
		eval(
			'this.contentTree.openItemClick = '+
			this.contentTree.openItemClick.toSource().replace(
				/(whereToOpenLink\(aEvent\))/,
				newOpenItemClick
			)
		);
		eval(
			'this.contentTree.openItemKey = '+
			this.contentTree.openItemKey.toSource().replace(
				/current/,
				'(Bookmarks2PaneService.shouldOpenNewTab ? $1tab$1 : $1current$1 )'
			)
		);
	},

	overrideTree : function(aTree, aType)
	{
		aTree.getRootResource = this.treeBookmarksImplementations.getRootResource;
		aTree.openFolderContent = this.treeBookmarksImplementations.openFolderContent;

		aTree.tree.setAttribute('onclick', 'this.parentNode.openItemClick(event, 1); this.parentNode.openFolderContent(event, 1);');
		aTree.tree.setAttribute('ondblclick', 'this.parentNode.openItemClick(event, 2); this.parentNode.openFolderContent(event, 2);');
		aTree.tree.setAttribute('onkeypress', 'if (event.keyCode == 13) { this.parentNode.openItemKey(); this.parentNode.openFolderContent(event); }');

		aTree.tree.setAttribute('onselect',
			'Bookmarks2PaneService.currentTree = this.parentNode; '+
			aTree.tree.getAttribute('onselect')
		);
		aTree.tree.setAttribute('onfocus', 'Bookmarks2PaneService.currentTree = this.parentNode;');
		aTree.tree.setAttribute('onmousedown', 'Bookmarks2PaneService.currentTree = this.parentNode;');
		aTree.tree.setAttribute('onkeydown', 'Bookmarks2PaneService.currentTree = this.parentNode;');

		if (aType == 'content') {
			aTree.setAttribute('ref', 'rdf:null');
			aTree.tree.setAttribute('ref', 'rdf:null');

			aTree.onFolderContentOpen = this.treeBookmarksImplementations.onContentTreeFolderContentOpen;
			aTree.__defineGetter__('label', this.treeBookmarksImplementations.contentTreeLabelGetter);
		}
		else {
			aTree.tree.setAttribute('ref', 'NC:BookmarksTopRoot');
			var template = aTree.tree.getElementsByTagName('template')[0];
			template.lastChild.setAttribute('iscontainer', 'true')
			while (template.lastChild != template.firstChild)
				template.removeChild(template.firstChild);

			aTree.searchBookmarks = this.treeBookmarksImplementations.searchBookmarks;
			aTree.onFolderContentOpen = this.treeBookmarksImplementations.onFolderTreeFolderContentOpen;
		}

		aTree.treeBuilder.rebuild();
	},
	treeBookmarksImplementations : {
		getRootResource : function()
		{
			return RDF.GetResource(this.tree.ref);
		},
		openFolderContent : function(aEvent, aClickCount)
		{
			if (aClickCount !== void(0) &&
				aEvent.type != 'keypress') {
				if (aEvent.button == 2 ||
					aEvent.originalTarget.localName != 'treechildren')
					return;
			}

			var row = {};
			var col = {};
			var obj = {};
			this.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, col, obj);
			row = row.value;

			if (/*row == -1 ||*/ aEvent.type != 'keypress' && obj.value == 'twisty') return;

			if (aEvent.type != 'keypress') {
				var modifKey = aEvent.shiftKey ||
								aEvent.ctrlKey ||
								aEvent.altKey ||
								aEvent.metaKey  ||
								aEvent.button == 1;
				if (this.clickCount == 2 && modifKey) {
					/*
						treeBoxObject.view.selection : 2.0-
						view.selection : 1.8a-1.9
						treeBoxObject.selection : -1.7.x
					*/
					(
						'view' in this.treeBoxObject ?
							this.treeBoxObject.view.selection :
						'selection' in this.treeBoxObject ?
							this.treeBoxObject.selection :
							this.view.selection
						).select(row);
					this._selection = this.getTreeSelection();
				}
			}

			var selection = this._selection;
			if (!selection || !selection.isContainer[0]) return;

			if (
				'onFolderContentOpen' in this &&
				!this.onFolderContentOpen(aEvent, aClickCount, selection)
				)
				return;
		},



		/* for Folder Tree */

		searchBookmarks : function(aInput)
		{
			/*
				treeBoxObject.view.selection : 2.0-
				view.selection : 1.8a-1.9
				treeBoxObject.selection : -1.7.x
			*/
			(
				'view' in this.treeBoxObject ?
					this.treeBoxObject.view.selection :
				'selection' in this.treeBoxObject ?
					this.treeBoxObject.selection :
					this.tree.view.selection
				).currentIndex = -1;

			this.dispatchEvent(Bookmarks2PaneService.createSearchEvent(aInput));
		},

		onFolderTreeFolderContentOpen : function(aEvent, aClickCount, aSelection)
		{
			var modifKey = aEvent.shiftKey ||
							aEvent.ctrlKey ||
							aEvent.altKey ||
							aEvent.metaKey  ||
							aEvent.button == 1;

			if (
				aEvent.type == 'keypress' ||
				(
				aClickCount == 1 &&
				!modifKey
				)
				) {
				if (
					aSelection.length != 1 ||
					('protocol' in aSelection && aSelection.protocol[0] != 'file')
					)
					return false;
			}

			var event = document.createEvent('Events');
			event.initEvent('Bookmarks2PaneOnFolderSelect', false, true);
			event.targetQuery  = 'selection';
			this.dispatchEvent(event);

			return true;
		},


		/* Content Tree */

		onContentTreeFolderContentOpen : function(aEvent, aClickCount, aSelection)
		{
				if (
					(
					aSelection.type[0] != 'Folder' &&
					aSelection.type[0] != 'PersonalToolbarFolder'
					) ||
					(
					aEvent.type != 'keypress' &&
					aClickCount == 1
					)
					) {
					aEvent.stopPropagation();
					return false;
				}
				return true;
		},

		contentTreeLabelGetter : function()
		{
			return document.getAnonymousElementByAttribute(this, 'anonid', 'bookmarks-tree-content-label');
		}

	},




	showHideForSearch : function(aShow, aContent)
	{
		var tree = aContent ? this.contentTree : this.mainTree ;
		if (aShow) {
			tree.removeAttribute('collapsed');
			this.contentLabelBox.removeAttribute('collapsed');
			this.dustbox.removeAttribute('collapsed');
			this.splitter.removeAttribute('collapsed');
		}
		else {
			tree.setAttribute('collapsed', true);
			this.contentLabelBox.setAttribute('collapsed', true);
			this.dustbox.setAttribute('collapsed', true);
			this.splitter.setAttribute('collapsed', true);
		}
	},



	// command

	deleteCurrentSelection : function()
	{
		if (this.isPlaces) {
			this.currentTree.controller.remove('Remove Selection');
		}
		else {
			var selection = this.currentTree.getTreeSelection();
			if (!selection.length) return;
			BookmarksCommand.deleteBookmark(selection);
		}
	},

	dustboxDNDObserver : {
		onDrop : function(aEvent, aTransferData, aSession)
		{
			if (!aSession.sourceNode ||
				aSession.sourceNode.parentNode != Bookmarks2PaneService.currentTree)
				return;
			Bookmarks2PaneService.deleteCurrentSelection();
		},
		onDragOver : function() {},
		onDragExit : function() {},
		getSupportedFlavours : function()
		{
			var flavours = new FlavourSet();
			if (Bookmarks2PaneService.isPlaces) {
				var types = PlacesUIUtils.GENERIC_VIEW_DROP_TYPES;
				types.forEach(function(aType) {
					flavours.appendFlavour(aType);
				});
			}
			else {
				flavours.appendFlavour('moz/rdfitem');
			}
			return flavours;
		}
	},


	// compatibility

	hackForOtherExtensions : function()
	{
		// hack for Bookmarks Duplicate Detector
		if ('BddsearchBookmarks' in window)
			eval(
				'window.BddsearchBookmarks = '+
				window.BddsearchBookmarks.toSource().replace(
					/(if\s*\(!aInput\))/,
					'var event = document.createEvent("Events"); event.initEvent("Bookmarks2PaneOnFolderSelect", false, true); $1'
				).replace(
					/bookmarkView\.tree\.setAttribute\(\s*['"]ref['"],\s*bookmarkView\.originalRef\s*\)/,
					'event.targetQuery = null'
				).replace(
					/bookmarkView\.tree\.setAttribute\(\s*['"]ref['"],/g,
					'event.targetQuery = ('
				).replace(
					/\}(\)?)$/,
					'; Bookmarks2PaneService.mainTree.dispatchEvent(event);}$1'
				)
			);


		// hack for Boox
		if ('booxBPTooltip' in window)
			eval(
				'window.booxBPTooltip.fillInTooltip = '+
				window.booxBPTooltip.fillInTooltip.toSource().replace(
					'var tree = document.getElementById("bookmarks-view").tree;',
					'var tree = document.tooltipNode || document.popupNode;'+
					'while (tree.parentNode && tree.localName != "bookmarks-tree") {'+
						'tree = tree.parentNode;'+
					'};'+
					'if (!tree) { return false; } else { tree = tree.tree; };'
				)
			);


		// hack for Locate in Bookmark Folders
		if ('libfOverlayBP' in window)
			eval(
				'window.libfOverlayBP.locateInFolders = '+
				window.libfOverlayBP.locateInFolders.toSource().replace(
					'{',
					'{ Bookmarks2PaneService.showHideForSearch(true, true); '
				).replace(
					/libfOverlayBP\.bookmarksView/g,
					'Bookmarks2PaneService.contentTree'
				)
			);


		// hack for Bookmark quick folder
		if ('BqsOverlay' in window)
			eval(
				'window.BqsOverlay.doMove = '+
				window.BqsOverlay.doMove.toSource().replace(
					'document.getElementById("bookmarks-view")',
					'Bookmarks2PaneService.currentTree'
				)
			);

	}

};


window.addEventListener('load', Bookmarks2PaneService, false);
