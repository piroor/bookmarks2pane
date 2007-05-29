var version     = '0.3.2007052001',
	displayName = '2 Pane Bookmarks',
	appName     = 'bookmarks2pane',
	author      = 'SHIMODA Hiroshi',
	newTypeOnly = true,
	hasLangPack = true,
	hasJLP      = true;


var err         = initInstall(
		displayName,
		appName,
		version
		),
	UChrome     = getFolder('Chrome'),
	messages    = loadResources('locale.inf'),
	optionsMsg  = ('options' in this && options.length ? loadResources('options.inf') : null ),
	installedOptions = [],
	files       = [],
	jarName     = appName+'.jar',
	contentFlag = CONTENT | DELAYED_CHROME,
	localeFlag  = LOCALE | DELAYED_CHROME,
	skinFlag    = SKIN | DELAYED_CHROME,
	i;


var existsInGlobal  = File.exists(getFolder(UChrome, jarName));
var existsInProfile = File.exists(getFolder(getFolder('Current User', 'chrome'), jarName));
var isNewType       = File.exists(getFolder(UChrome, 'browser.jar'));

if ('newTypeOnly' in this && newTypeOnly && !isNewType) {
	alert(messages.newTypeOnly);
	cancelInstall(err);
}
else if (existsInGlobal && existsInProfile) {
	cancelInstall(err);
}
else {

	if (existsInProfile ||
		(!existsInGlobal && confirm(messages.installToProfile))) {
		UChrome = getFolder('Current User', 'chrome');
		contentFlag = CONTENT | PROFILE_CHROME;
		localeFlag  = LOCALE | PROFILE_CHROME;
		skinFlag    = SKIN | PROFILE_CHROME;
	}


	logComment('initInstall: ' + err);
	setPackageFolder(UChrome);

//	if (File.exists(getFolder(UChrome, jarName))) {
//		alert(messages.exists);
//		cancelInstall(err);
//	}
//	else {
	var i = 0;
		addFile(author, 'chrome/'+jarName, UChrome, '');
		var folder = getFolder(UChrome, jarName);
		files.push(folder);

		registerChrome(contentFlag, folder, 'content/'+appName+'/');

		if (('widgetsName' in this && widgetsName) ||
			('bindingsName' in this && bindingsName)) {
			if (
				isNewType &&
				(
					Install.buildID < 2003111900 &&
					!File.exists(getFolder('Program', 'firefox.exe')) &&
					!File.exists(getFolder('Program', 'firefox-bin.exe')) &&
					!File.exists(getFolder('Program', 'firefox')) &&
					!File.exists(getFolder('Program', 'firefox-bin'))
				)
				) {
				if (widgetsName)
					registerChrome(contentFlag, folder, 'content/'+widgetsName+'/');
			}
			else if (bindingsName)
					registerChrome(contentFlag, folder, 'content/'+bindingsName+'/');
		}


		if ('options' in this && options.length) {
			for (i = 0; i < options.length; i++)
			{
				if (confirm(optionsMsg[options[i]])) {
					registerChrome(contentFlag, folder, 'content/'+options[i]+'/');
					installedOptions.push(options[i]);
				}
			}
		}


		// Language packs
		if ('hasLangPack' in this && hasLangPack) {
			registerChrome(localeFlag, folder, 'locale/en-US/'+appName+'/');
			registerChrome(localeFlag, folder, 'locale/ja-JP/'+appName+'/');
			registerChrome(localeFlag, folder, 'locale/sk-SK/'+appName+'/');
			registerChrome(localeFlag, folder, 'locale/hu-HU/'+appName+'/');
			registerChrome(localeFlag, folder, 'locale/it-IT/'+appName+'/');

			for (i = 0; i < installedOptions.length; i++) {
				registerChrome(localeFlag, folder, 'locale/en-US/'+installedOptions[i]+'/');
				registerChrome(localeFlag, folder, 'locale/ja-JP/'+installedOptions[i]+'/');
			}
		}

		if ('hasSkin' in this && hasSkin) {
			registerChrome(skinFlag, folder, 'skin/classic/'+appName+'/');
		}

		err = getLastError();
		if (err == SUCCESS) {
			performInstall();
			alert(
				'Ver.'+version+'\n\n'+
				messages.installed+'\n'+
				files.join('\n')+'\n\n\n'+
				messages.complete+
				(contentFlag & PROFILE_CHROME ? '' : '\n\n'+messages.permissionNotes)
			);
		}
		else {
			cancelInstall(err);
		}
//	}
}
