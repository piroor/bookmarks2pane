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

	get shouldOpenNewTab()
	{
		return nsPreferences.getBoolPref('bookmarks2pane.open_new_tab_always');
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

		this.overrideTree(this.mainTree, 'main');
		this.overrideTree(this.contentTree, 'content');
		this.currentTree     = this.mainTree;

		this.hackForOtherExtensions();

		window.setTimeout('Bookmarks2PaneService.delayedInit()', 0);
	},
	delayedInit : function()
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
		aTree.getRootResource = this.treeImplementations.getRootResource;
		aTree.openFolderContent = this.treeImplementations.openFolderContent;

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

			aTree.onFolderContentOpen = this.treeImplementations.onContentTreeFolderContentOpen;
			aTree.__defineGetter__('label', this.treeImplementations.contentTreeLabelGetter);
		}
		else {
			aTree.tree.setAttribute('ref', 'NC:BookmarksTopRoot');
			var template = aTree.tree.getElementsByTagName('template')[0];
			template.lastChild.setAttribute('iscontainer', 'true')
			while (template.lastChild == template.firstChild)
				template.removeChild(template.firstChild);

			aTree.searchBookmarks = this.treeImplementations.searchBookmarks;
			aTree.onFolderContentOpen = this.treeImplementations.onFolderTreeFolderContentOpen;

			aTree.addEventListener('click', this.onToggleOpenState, false);
			aTree.addEventListener('keypress', this.onToggleOpenStateKey, false);
			aTree.addEventListener('Bookmarks2PaneOnFolderSelect', this.onTargetChange, false);
		}

		aTree.treeBuilder.rebuild();
	},

	treeImplementations : {
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

			var event = document.createEvent('Events');
			event.initEvent('Bookmarks2PaneOnFolderSelect', false, true);

			if (!aInput) {
				event.targetRef = null;
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
				event.targetRef = 'find:datasource=rdf:bookmarks&match=http://home.netscape.com/NC-rdf#'+match+'&method=contains&text=' + escape(aInput);
			}

			this.dispatchEvent(event);
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
			event.targetRef  = 'selection';
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
			tree.tree.setAttribute('ref', selection.item[0].Value);
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
				tree.tree.setAttribute('ref', aEvent.targetRef);
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
	},



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
					'event.targetRef = null'
				).replace(
					/bookmarkView\.tree\.setAttribute\(\s*['"]ref['"],/g,
					'event.targetRef = ('
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

	}

};


window.addEventListener('load', function() { Bookmarks2PaneService.init(); }, false);
window.addEventListener('load', function() { Bookmarks2PaneService.init(); }, false); // failsafe
