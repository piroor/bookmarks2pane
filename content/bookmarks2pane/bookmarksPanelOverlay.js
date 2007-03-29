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

	initialized : false,

	get shouldOpenOnlyOneTree()
	{
		return nsPreferences.getBoolPref('bookmarks2pane.open_only_one_tree');
	},

	init : function()
	{
		if (this.initialized) return;
		this.initialized = true;


		this.mainTree        = document.getElementById('bookmarks-view');
		this.contentTree     = document.getElementById('bookmarks-content-view');
		this.contentLabel    = document.getElementById('bookmarks-content-label');
		this.contentLabelBox = document.getElementById('bookmarks-content-label-box');
		this.dustbox         = document.getElementById('bookmarks-dustbox');
		this.splitter        = document.getElementById('bookmarks-panes-splitter');
		this.currentTree     = this.mainTree;

		this.mainTree.addEventListener('click', this.onToggleOpenState, false);
		this.mainTree.addEventListener('keypress', this.onToggleOpenStateKey, false);
		this.mainTree.addEventListener('Bookmarks2PaneOnFolderSelect', this.onTargetChange, false);


		// hack for Bookmarks Duplicate Detector
		if ('BddsearchBookmarks' in window)
			eval(
				'window.BddsearchBookmarks = '+
				window.BddsearchBookmarks.toSource().replace(
					/(if\s*\(!aInput\))/,
					'var event = document.createEvent("Events"); event.initEvent("Bookmarks2PaneOnFolderSelect", false, true); $1'
				).replace(
					/bookmarkView\.tree\.setAttribute\(\s*['"]ref['"],\s*bookmarkView\.originalRef\s*\)/,
					'event.targetRef = null'
				).replace(
					/bookmarkView\.tree\.setAttribute\(\s*['"]ref['"],/g,
					'event.targetRef = ('
				).replace(
					/\}(\)?)$/,
					'; Bookmarks2PaneService.mainTree.dispatchEvent(event);}$1'
				)
			);

		window.setTimeout('Bookmarks2PaneService.delayedInit()', 0);
	},
	delayedInit : function()
	{
		var lastRef = nsPreferences.copyUnicharPref('bookmarks2pane.last_selected_folder') || 'rdf:null';
		if (lastRef != 'rdf:null') {
			this.contentTree.setAttribute('ref', lastRef);
			this.contentTree.treeBuilder.rebuild();
			this.contentLabel.value = BookmarksUtils.getProperty(RDF.GetResource(lastRef), 'http://home.netscape.com/NC-rdf#Name');
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
		var tree = Bookmarks2PaneService.contentTree;
		if (aEvent.targetRef == 'selection') {
			var selection = Bookmarks2PaneService.mainTree._selection;
			tree.setAttribute('ref', selection.item[0].Value);
			tree.treeBuilder.rebuild();

			Bookmarks2PaneService.contentLabel.value = BookmarksUtils.getProperty(selection.item[0], 'http://home.netscape.com/NC-rdf#Name');

			nsPreferences.setUnicharPref('bookmarks2pane.last_selected_folder', selection.item[0].Value);

			window.setTimeout(Bookmarks2PaneService.onTargetChangeCallback, 0);
		}
		else {
			if (!aEvent.targetRef) {
				tree.setAttribute('ref', tree.originalRef);
				Bookmarks2PaneService.contentLabel.value = BookmarksUtils.getProperty(RDF.GetResource(tree.originalRef), 'http://home.netscape.com/NC-rdf#Name');

				Bookmarks2PaneService.mainTree.removeAttribute('collapsed');
				Bookmarks2PaneService.contentLabelBox.removeAttribute('collapsed');
				Bookmarks2PaneService.dustbox.removeAttribute('collapsed');
				Bookmarks2PaneService.splitter.removeAttribute('collapsed');
			}
			else {
				if (!tree.originalRef) {
					tree.originalRef = tree.getAttribute('ref');
				}
				tree.setAttribute('ref', aEvent.targetRef);
				Bookmarks2PaneService.contentLabel.value = '';

				Bookmarks2PaneService.mainTree.setAttribute('collapsed', true);
				Bookmarks2PaneService.contentLabelBox.setAttribute('collapsed', true);
				Bookmarks2PaneService.dustbox.setAttribute('collapsed', true);
				Bookmarks2PaneService.splitter.setAttribute('collapsed', true);
			}
		}
	},
	onTargetChangeCallback : function()
	{
		Bookmarks2PaneService.contentTree.treeBoxObject.scrollToRow(0);
	},




	deleteCurrentSelection : function()
	{
		var selection = this.currentTree.getTreeSelection();
		if (!selection.length) return;
		BookmarksCommand.deleteBookmark(selection);
	},

	dustboxDNDObserver : {
		onDrop : function(aEvent, aTransferData, aSession)
		{
			BookmarksCommand.deleteBookmark(Bookmarks2PaneService.currentTree.getTreeSelection());
		},
		onDragOver : function() {},
		onDragExit : function() {},
		getSupportedFlavours : function()
		{
			var flavours = new FlavourSet();
			flavours.appendFlavour('moz/rdfitem');
			return flavours;
		}
	}

};


window.addEventListener('load', function() { Bookmarks2PaneService.init(); }, false);
window.addEventListener('load', function() { Bookmarks2PaneService.init(); }, false); // failsafe
