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

		this.contentTree = document.getElementById('places-content-view');
		this.mainTree.addEventListener('select', this, false);
		this.contentTree.addEventListener('select', this, false);
		this.initPlaces();

		this.contentTree.removeAttribute('collapsed');
		this.showHideTreeForSearch(true);

		this.hackForOtherExtensions();
	},
 
	destroy : function() 
	{
		window.removeEventListener('unload', this, false);

		this.mainTree.removeEventListener('click', this, false);
		this.mainTree.removeEventListener('keypress', this, false);
		this.mainTree.removeEventListener('Bookmarks2PaneOnFolderSelect', this, false);

		this.mainTree.removeEventListener('select', this, false);
		this.contentTree.removeEventListener('select', this, false);
	},
 
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'select':
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
			this.onToggleOpenState(aEvent);
	},
 
	// from BX (http://tkm.s31.xrea.com/xul/bx.shtml, made by plus7)
	onToggleOpenState: function (aEvent) 
	{
		if (!this.shouldOpenOnlyOneTree) return;

		var tree = aEvent.currentTarget;
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
		if (currentIndex < 0 || !view.isContainer(currentIndex)) {
			return;
		}
		var firstVisibleRow = tree.treeBoxObject.getFirstVisibleRow();
		if (
			aEvent.type != 'keypress' &&
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
		var tree = aEvent.currentTarget;
		if (aEvent.targetQuery == 'selection' &&
			tree.selectedNode) {
			switch (tree.selectedNode.type)
			{
				case Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER:
				case Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER_SHORTCUT:
					this.contentTree.place = 'place:queryType=1&folder=' + tree.selectedNode.itemId;
					break;
				case Ci.nsINavHistoryResultNode.RESULT_TYPE_QUERY:
				case Ci.nsINavHistoryResultNode.RESULT_TYPE_DYNAMIC_CONTAINER:
					this.contentTree.place = 'place:queryType=1&folder=' + tree.selectedNode.uri;
					break;
				default:
					return;
			}
			this.contentLabel.value = tree.selectedNode.title;
			nsPreferences.setUnicharPref('bookmarks2pane.last_selected_folder', this.contentTree.place);
			nsPreferences.setIntPref('bookmarks2pane.last_selected_folder_id', this.mainTree.selectedNode.folderItemId);
			window.setTimeout(this.onTargetChangeCallback, 0);
		}
		else {
			if (!aEvent.targetQuery) {
				if (this.lastTitle) {
					this.contentLabel.value = this.lastTitle;
					this.lastTitle = '';
				}
				this.showHideTreeForSearch(true);
			}
			else {
				this.lastTitle = this.contentLabel.value;
				this.contentLabel.value = '';
				this.showHideTreeForSearch(false);
			}
		}
	},
	
	onTargetChangeCallback : function() 
	{
		Bookmarks2PaneService.contentTree.treeBoxObject.scrollToRow(0);
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

		eval('PlacesUIUtils.openNodeWithEvent = '+
			PlacesUIUtils.openNodeWithEvent.toSource().replace(
				'whereToOpenLink',
				'Bookmarks2PaneService.$&'
			)
		);

		var lastPlace = nsPreferences.copyUnicharPref('bookmarks2pane.last_selected_folder') || '';
		if (lastPlace.indexOf('place:') == 0) {
			var bmsv = Components
					.classes['@mozilla.org/browser/nav-bookmarks-service;1']
					.getService(Components.interfaces.nsINavBookmarksService);
			try {
				var title = bmsv.getItemTitle(nsPreferences.getIntPref('bookmarks2pane.last_selected_folder_id'));
				this.contentLabel.value = title;
			}
			catch(e) {
			}
			this.contentTree.place = lastPlace;
		}
	},
 
	whereToOpenLink : function(aEvent) 
	{
		var where = whereToOpenLink(aEvent);
		if (this.shouldOpenNewTab) {
			if (where == 'current')
				where = 'tab';
			else if (where.indexOf('tab') == 0)
				where = 'current';
		}
		return where;
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
  
	showHideTreeForSearch : function(aShow) 
	{
		var tree = this.contentTree;
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
		this.currentTree.controller.remove('Remove Selection');
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
			var types = PlacesUIUtils.GENERIC_VIEW_DROP_TYPES;
			types.forEach(function(aType) {
				flavours.appendFlavour(aType);
			});
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
					'if (!tree) { return false; } else if (tree.tree) { tree = tree.tree; };'
				)
			);


		// hack for Locate in Bookmark Folders
		if ('libfOverlayBP' in window)
			eval(
				'window.libfOverlayBP.locateInFolders = '+
				window.libfOverlayBP.locateInFolders.toSource().replace(
					'{',
					'{ Bookmarks2PaneService.showHideTreeForSearch(true); '
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
  
