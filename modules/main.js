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

function FullscreenObserver(aWindow) {
	this.window = aWindow;
	this.init();
}
FullscreenObserver.prototype = {
	get MutationObserver()
	{
		var w = this.window;
		return w.MutationObserver || w.MozMutationObserver;
	},

	init : function FullscreenObserver_onInit() 
	{
		if (!this.MutationObserver)
			return;
		this.observer = new this.MutationObserver((function(aMutations, aObserver) {
			this.onMutation(aMutations, aObserver);
		}).bind(this));
		this.observer.observe(this.window.document.documentElement, { attributes : true });

		this.onSizeModeChange();
	},

	destroy : function FullscreenObserver_destroy()
	{
		if (this.observer) {
			this.observer.disconnect();
			delete this.observer;
		}
		delete this.window;
	},

	onMutation : function FullscreenObserver_onMutation(aMutations, aObserver) 
	{
		aMutations.forEach(function(aMutation) {
			if (aMutation.type != 'attributes')
				return;
			if (aMutation.attributeName == 'sizemode' &&
				this.window.document.documentElement.getAttribute('sizemode') == 'fullscreen')
				this.window.setTimeout((function() {
					this.onSizeModeChange();
				}).bind(this), 10);
		}, this);
	},

	onSizeModeChange : function FullscreenObserver_onSizeModeChange()
	{
		var d = this.window.document;

		var toolbox = this.window.gNavToolbox;
		toolbox.style.marginTop = -toolbox.getBoundingClientRect().height + 'px';

		var windowControls = d.getElementById('window-controls');
		var navigationToolbar = d.getElementById('nav-bar');
		if (!windowControls ||
			!navigationToolbar ||
			windowControls.parentNode == navigationToolbar)
			return;

		// the location bar is flex=1, so we should not apply it.
		// windowControls.setAttribute('flex', '1');
		navigationToolbar.appendChild(windowControls);
	}
};

var baseStyles = new WeakMap();
var platformStyles = new WeakMap();
var fullscreenObservers = new WeakMap();

function handleWindow(aWindow)
{
	var doc = aWindow.document;
	if (doc.documentElement.getAttribute('windowtype') != TYPE_BROWSER)
		return;

	aWindow.TabsInTitlebar.allowedBy('tabsOnBottom', false);

	baseStyles.set(aWindow, addStyleSheet(baseStyleURL, aWindow));
	platformStyles.set(aWindow, addStyleSheet(platformStyleURL, aWindow));
	fullscreenObservers.set(aWindow, new FullscreenObserver(aWindow));

	aWindow.addEventListener('unload', function onUnload() {
		aWindow.addEventListener('unload', onUnload, false);

		baseStyles.delete(aWindow);
		platformStyles.delete(aWindow);

		var observer = fullscreenObservers.get(aWindow);
		observer.destroy();
		fullscreenObservers.delete(aWindow);
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

		var observer = fullscreenObservers.get(aWindow);
		observer.destroy();
		fullscreenObservers.delete(aWindow);
	});

	WindowManager = undefined;
	baseStyles = undefined;
	platformStyles = undefined;
}
