var Bookmarks2PaneService = { 
	
	get shouldOpenOnlyOneTree() 
	{
		return this.prefs.getPref('bookmarks2pane.open_only_one_tree');
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
		this.contentTreeBox = document.getElementById('bookmarks-content-box');
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
				var event = new CustomEvent('Bookmarks2PaneOnFolderSelect', {
					bubbles    : false,
					cancelable : false,
					detail     : {
						targetQuery : 'selection'
					}
				});
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


			case 'dragenter':
			case 'dragover':
				return this.canDropToDustbox(aEvent);

			case 'drop':
				return this.onDropToDustbox(aEvent);
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
		var query = aEvent.detail.targetQuery;
		if (query == 'selection') {
			if (tree.selectedNode) {
				switch (tree.selectedNode.type)
				{
					case Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER:
					case Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER_SHORTCUT:
						// folderItemId is for root folders
						var id = tree.selectedNode.folderItemId || tree.selectedNode.itemId;
						this.contentTree.place = 'place:queryType=1&folder=' + id;
						break;
					case Ci.nsINavHistoryResultNode.RESULT_TYPE_QUERY:
					case Ci.nsINavHistoryResultNode.RESULT_TYPE_DYNAMIC_CONTAINER:
						this.contentTree.place = tree.selectedNode.uri;
						break;
					default:
						return;
				}
				this.contentLabel.value = tree.selectedNode.title;
				this.prefs.setPref('bookmarks2pane.last_selected_folder', this.contentTree.place);
				this.prefs.setPref('bookmarks2pane.last_selected_folder_id', this.mainTree.selectedNode.folderItemId || this.mainTree.selectedNode.itemId);
				window.setTimeout(function(aSelf) {
					aSelf.onTargetChangeCallback();
				}, 0, this);
			}
		}
		else {
			if (!query) {
				if (this.lastTitle) {
					this.contentLabel.value = this.lastTitle;
					this.lastTitle = '';
				}
				this.showHideTreeForSearch(true);
			}
			else {
				if (this.contentLabel.value) {
					this.lastTitle = this.contentLabel.value;
				}
				this.contentLabel.value = '';
				this.showHideTreeForSearch(false);
			}
		}
	},
	
	onTargetChangeCallback : function() 
	{
		this.contentTree.treeBoxObject.scrollToRow(0);
	},
 
	canDropToDustbox : function(aEvent)
	{
		var dt = aEvent.dataTransfer;
		if (this.canDropToDustboxType(aEvent)) {
			dt.effectAllowed = dt.dropEffect = 'move';
			aEvent.preventDefault();
			return true;
		}
		else {
			dt.effectAllowed = dt.dropEffect = 'none';
			return false;
		}
	},
	canDropToDustboxType : function(aEvent)
	{
		var types = PlacesUIUtils.GENERIC_VIEW_DROP_TYPES || // Firefox 3 - 3.6
					PlacesControllerDragHelper.GENERIC_VIEW_DROP_TYPES; // Firefox 4-

		var dt = aEvent.dataTransfer;
		if (dt.mozItemCount < 1)
			return false;

		for (let i = 0, maxi = dt.mozItemCount; i < maxi; i++)
		{
			let itemTypes = dt.mozTypesAt(i);
			if (!types.some(itemTypes.contains, itemTypes))
				return false;
		}
		return true;
	},
 
	onDropToDustbox : function(aEvent)
	{
		if (!this.canDropToDustbox(aEvent))
			return;

		var session = this.currentDragSession;
		if (!session.sourceNode ||
			session.sourceNode.parentNode != this.currentTree)
			return;

		this.deleteCurrentSelection();
	},
	get currentDragSession() 
	{
		return Components.classes['@mozilla.org/widget/dragservice;1']
				.getService(Components.interfaces.nsIDragService)
				.getCurrentSession();
	},
   
	// Places 
	
	initPlaces : function() 
	{
		eval('PlacesTreeView.prototype._buildVisibleSection = '+
			PlacesTreeView.prototype._buildVisibleSection.toSource().replace(
				/(let curChildType = curChild.type;)/,
				'$1\n' +
				'  if (\n' +
				'    (\n' +
				'      this.selection &&\n' +
				'      this.selection.tree &&\n' +
				'      Bookmarks2PaneService.isNormalItemType(curChildType)\n' +
				'    ) ?\n' +
				'      (\n' +
				'        this.selection.tree.element == Bookmarks2PaneService.mainTree &&\n' +
				'        !Bookmarks2PaneService.doingSearch\n' +
				'      ) :\n' +
				'      (\n' +
				'        this.selection.tree.element == Bookmarks2PaneService.contentTree/* &&\n' +
				'        curChild.parent.folderItemId != aContainer.folderItemId*/\n' +
				'      )\n' +
				'    ) {\n' +
				'    this._rows.splice(aFirstChildRow + rowsInserted, 1);\n' +
				'    continue;\n' +
				'  }\n'
			).replace(
				'if (this._isPlainContainer(aContainer))',
				'$& {\n' +
				'  if (this.selection &&\n' +
				'    this.selection.tree &&\n' +
				'    this.selection.tree.element == Bookmarks2PaneService.mainTree &&\n' +
				'    !Bookmarks2PaneService.doingSearch) {\n' +
				'    this._rows.splice(aFirstChildRow, cc);\n' +
				'    return 0;\n' +
				'  }\n' +
				'}\n' +
				'$&\n'
			)
		);

		eval('PlacesTreeView.prototype.nodeInserted = '+
			PlacesTreeView.prototype.nodeInserted.toSource().replace(
				'if (PlacesUtils.nodeIsSeparator(aNode)',
				'  if ((this._tree.element == Bookmarks2PaneService.mainTree) ==\n' +
				'    Bookmarks2PaneService.isNormalItemType(aNode.type))\n' +
				'    return;\n' +
				'$&\n'
			)
		);

		eval('PlacesTreeView.prototype.nodeRemoved = '+
			PlacesTreeView.prototype.nodeRemoved.toSource().replace(
				// -Firefox 3.6: var oldViewIndex = ...
				// Firefox 4-: if (PlacesUtils.nodeIsSeparator(aNode) ...
				/(var oldViewIndex = |if \(PlacesUtils.nodeIsSeparator\(aNode\))/,
				'  if ((this._tree.element == Bookmarks2PaneService.mainTree) ==\n' +
				'    Bookmarks2PaneService.isNormalItemType(aNode.type))\n' +
				'    return;\n' +
				'$1\n'
			)
		);

		eval('PlacesTreeView.prototype.nodeMoved = '+
			PlacesTreeView.prototype.nodeMoved.toSource().replace(
				/(if \(PlacesUtils.nodeIsSeparator\(aNode\))/,
				'  if ((this._tree.element == Bookmarks2PaneService.mainTree) ==\n' +
				'    Bookmarks2PaneService.isNormalItemType(aNode.type))\n' +
				'    return;\n' +
				'$1\n'
			)
		);

		init();

		window.__bookmarks2pane__searchBookmarks = window.searchBookmarks;
		window.searchBookmarks = function(aSearchString, ...aArgs) {
			Bookmarks2PaneService.doingSearch = aSearchString ? true : false ;
			var retVal = window.__bookmarks2pane__searchBookmarks.apply(this, [aSearchString].concat(aArgs));
			Bookmarks2PaneService.mainTree.dispatchEvent(Bookmarks2PaneService.createSearchEvent(aSearchString));
			return retVal;
		};

		var lastPlace = this.prefs.getPref('bookmarks2pane.last_selected_folder') || '';
		if (lastPlace.indexOf('place:') == 0) {
			let bmsv = Components
					.classes['@mozilla.org/browser/nav-bookmarks-service;1']
					.getService(Components.interfaces.nsINavBookmarksService);
			try {
				let title = bmsv.getItemTitle(this.prefs.getPref('bookmarks2pane.last_selected_folder_id'));
				this.contentLabel.value = title;
			}
			catch(e) {
			}
			this.contentTree.place = lastPlace;
		}
	},
 
	createSearchEvent : function(aInput) 
	{
		var detail = {};
		if (!aInput) {
			detail.targetQuery = null;
		}
		else {
			let match = 'Name';
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
			detail.targetQuery = 'find:datasource=rdf:bookmarks&match=http://home.netscape.com/NC-rdf#'+match+'&method=contains&text=' + escape(aInput);
		}

		var event = new CustomEvent('Bookmarks2PaneOnFolderSelect', {
			bubbles    : false,
			cancelable : false,
			detail     : detail
		});
		return event;
	},
  
	showHideTreeForSearch : function(aShow) 
	{
		if (aShow) {
			this.contentTreeBox.removeAttribute('collapsed');
			this.dustbox.removeAttribute('collapsed');
			this.splitter.removeAttribute('collapsed');
		}
		else {
			this.contentTreeBox.setAttribute('collapsed', true);
			this.dustbox.setAttribute('collapsed', true);
			this.splitter.setAttribute('collapsed', true);
		}
	},
 
	isNormalItemType : function(aType)
	{
		return !(
			aType == Ci.nsINavHistoryResultNode.RESULT_TYPE_DYNAMIC_CONTAINER ||
			aType == Ci.nsINavHistoryResultNode.RESULT_TYPE_QUERY ||
			aType == Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER ||
			aType == Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER_SHORTCUT
		);
	},
 
	// command 
	
	deleteCurrentSelection : function() 
	{
		this.currentTree.controller.remove('Remove Selection');
	},
 
	clearBookmarkLocation : function()
	{
		if (SidebarUtils.clearURLFromStatusBar) // -Firefox 3.6
			SidebarUtils.clearURLFromStatusBar();
		else if (SidebarUtils.setMouseoverURL) // Firefox 4-
			SidebarUtils.setMouseoverURL('');
		else
			throw new Error('bookmarks2pane: failed to clear bookmark location.');
	},
  
	// compatibility 
	
	hackForOtherExtensions : function() 
	{
		// hack for Bookmarks Duplicate Detector
		if ('BddsearchBookmarks' in window)
			eval('window.BddsearchBookmarks = '+window.BddsearchBookmarks.toSource().replace(
				/(if\s*\(!aInput\))/,
				'var Bookmarks2PaneOnFolderSelectEventDetail = {}; $1'
			).replace(
				/bookmarkView\.tree\.setAttribute\(\s*['"]ref['"],\s*bookmarkView\.originalRef\s*\)/,
				'Bookmarks2PaneOnFolderSelectEventDetail.targetQuery = null'
			).replace(
				/bookmarkView\.tree\.setAttribute\(\s*['"]ref['"],(.+)\)/g,
				'Bookmarks2PaneOnFolderSelectEventDetail.targetQuery = $1'
			).replace(
				/\}(\)?)$/,
				'; var event = new CustomEvent("Bookmarks2PaneOnFolderSelect", { bubbles : false, cancelable : true, detail : Bookmarks2PaneOnFolderSelectEventDetail }); Bookmarks2PaneService.mainTree.dispatchEvent(event);}$1'
			));


		// hack for Boox
		if ('booxBPTooltip' in window)
			eval('window.booxBPTooltip.fillInTooltip = '+window.booxBPTooltip.fillInTooltip.toSource().replace(
				'var tree = document.getElementById("bookmarks-view").tree;',
				'  var tree = document.tooltipNode || document.popupNode;\n' +
				'  while (tree.parentNode && tree.localName != "bookmarks-tree") {\n' +
				'    tree = tree.parentNode;\n' +
				'  }\n' +
				'  if (!tree)\n' +
				'    return false;\n' +
				'  else if (tree.tree)\n' +
				'    tree = tree.tree;\n'
			));


		// hack for Locate in Bookmark Folders
		if ('libfOverlayBP' in window)
			eval('window.libfOverlayBP.locateInFolders = '+window.libfOverlayBP.locateInFolders.toSource().replace(
				'{',
				'{ Bookmarks2PaneService.showHideTreeForSearch(true); '
			).replace(
				/libfOverlayBP\.bookmarksView/g,
				'Bookmarks2PaneService.contentTree'
			));


		// hack for Bookmark quick folder
		if ('BqsOverlay' in window)
			eval('window.BqsOverlay.doMove = '+window.BqsOverlay.doMove.toSource().replace(
				'document.getElementById("bookmarks-view")',
				'Bookmarks2PaneService.currentTree'
			));

	}
  
}; 
(function() {
	var namespace = {};
	Components.utils.import('resource://bookmarks2pane-modules/prefs.js', namespace);
	Bookmarks2PaneService.prefs = namespace.prefs;

	var root = document.getElementById('bookmarksPanel');
	if (namespace.prefs.getPref('bookmarks2pane.enabled')) {
		root.setAttribute('panesCount', '2');
	}
	else {
		root.removeAttribute('panesCount');
	}
})();

window.addEventListener('load', Bookmarks2PaneService, false);
  
