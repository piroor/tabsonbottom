/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

load('lib/WindowManager');

Cu.import('resource://gre/modules/Services.jsm');

const TYPE_BROWSER = 'navigator:browser';

var baseStyleURL = 'chrome://tabsonbottom/skin/base.css';
var platformStyleURL = 'chrome://tabsonbottom/skin/' + Services.appinfo.OS + '.css';

function addStyleSheet(aURL, aWindow)
{
	var d = aWindow.document;
	var pi = d.createProcessingInstruction(
				'xml-stylesheet',
				'type="text/css" href="'+aURL+'"'
			);
	d.insertBefore(pi, d.documentElement);
	return pi;
}

var baseStyles = new WeakMap();
var platformStyles = new WeakMap();

function handleWindow(aWindow)
{
	var doc = aWindow.document;
	if (doc.documentElement.getAttribute('windowtype') != TYPE_BROWSER)
		return;

	aWindow.TabsInTitlebar.allowedBy('tabsOnBottom', false);

	baseStyles.set(aWindow, addStyleSheet(baseStyleURL));
	platformStyles.set(aWindow, addStyleSheet(platformStyleURL));

	aWindow.addEventListener('unload', function onUnload() {
		aWindow.addEventListener('unload', onUnload, false);
		baseStyles.delete(aWindow);
		platformStyles.delete(aWindow);
	}, false);
}

WindowManager.getWindows(TYPE_BROWSER).forEach(handleWindow);
WindowManager.addHandler(handleWindow);

function shutdown()
{
	WindowManager.getWindows(TYPE_BROWSER).forEach(function(aWindow) {
		aWindow.TabsInTitlebar.allowedBy('tabsOnBottom', true);

		var base = baseStyles.get(aWindow);
		aWindow.document.removeChild(base);
		baseStyles.delete(aWindow);
		var platform = platformStyles.get(aWindow);
		aWindow.document.removeChild(platform);
		platformStyles.delete(aWindow);
	});

	WindowManager = undefined;
	baseStyles = undefined;
	platformStyles = undefined;
}
