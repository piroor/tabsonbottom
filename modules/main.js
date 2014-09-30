/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

load('lib/WindowManager');
load('lib/prefs');

var myPrefs = prefs.createStore('extensions.tabsonbottom@piro.sakura.ne.jp.');
myPrefs.define('newTabByDblclick', true);

Cu.import('resource://gre/modules/Services.jsm');

const TYPE_BROWSER = 'navigator:browser';

var baseStyleURL = 'chrome://tabsonbottom/skin/base.css';
var platformStyleURL = 'chrome://tabsonbottom/skin/' + Services.appinfo.OS + '.css';

function addStyleSheet(aURL, aWindow) {
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
	get MutationObserver() {
		var w = this.window;
		return w.MutationObserver || w.MozMutationObserver;
	},

	init : function FullscreenObserver_onInit() {
		if (!this.MutationObserver)
			return;
		this.observer = new this.MutationObserver((function(aMutations, aObserver) {
			this.onMutation(aMutations, aObserver);
		}).bind(this));
		this.observer.observe(this.window.document.documentElement, { attributes : true });

		this.onSizeModeChange();
	},

	destroy : function FullscreenObserver_destroy() {
		if (this.observer) {
			this.observer.disconnect();
			delete this.observer;
		}
		delete this.window;
	},

	onMutation : function FullscreenObserver_onMutation(aMutations, aObserver) {
		aMutations.forEach(function(aMutation) {
			if (aMutation.type != 'attributes')
				return;
			if (aMutation.attributeName == 'sizemode')
				this.window.setTimeout((function() {
					this.onSizeModeChange();
				}).bind(this), 10);
		}, this);
	},

	onSizeModeChange : function FullscreenObserver_onSizeModeChange() {
		var w = this.window;
		var d = w.document;
		if (d.documentElement.getAttribute('sizemode') != 'fullscreen')
			return;

		var toolbox = w.gNavToolbox;
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

function getTabStrip(aTabBrowser, aWindow) {
	if (!(aTabBrowser instanceof aWindow.Element))
		return null;

	var strip = aTabBrowser.mStrip;
	return (strip && strip instanceof Ci.nsIDOMElement) ?
			strip :
			evaluateXPath(
				'ancestor::xul:toolbar[1]',
				aTabBrowser.tabContainer,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue || aTabBrowser.tabContainer.parentNode;
}
function getTab(aEvent) {
	return evaluateXPath(
		'ancestor-or-self::xul:tab',
		aEvent.originalTarget || aEvent.target,
		Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
	).singleNodeValue;
}
function getClickable(aEvent) {
	return evaluateXPath(
		'ancestor-or-self::*[contains(" button toolbarbutton scrollbar nativescrollbar popup menupopup panel tooltip splitter textbox ", concat(" ", local-name(), " "))]',
		aEvent.originalTarget,
		Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
	).singleNodeValue;
}
var NSResolver = {
	lookupNamespaceURI : function(aPrefix) {
		switch (aPrefix) {
			case 'xul':
				return 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
			case 'html':
			case 'xhtml':
				return 'http://www.w3.org/1999/xhtml';
			case 'xlink':
				return 'http://www.w3.org/1999/xlink';
			default:
				return '';
		}
	}
};
function evaluateXPath(aExpression, aContext, aType) {
	if (!aType)
		aType = Ci.nsIDOMXPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
	try {
		var XPathResult = (aContext.ownerDocument || aContext).evaluate(
				aExpression,
				(aContext || document),
				NSResolver,
				aType,
				null
			);
	}
	catch(e) {
		return {
			singleNodeValue : null,
			snapshotLength  : 0,
			snapshotItem    : function() {
				return null
			}
		};
	}
	return XPathResult;
}

function onMozMouseHittest(aEvent) {
	if (!myPrefs.newTabByDblclick)
		return;
	// block default behaviors of the tab bar (dragging => window move, etc.)
	aEvent.stopPropagation();
}

function onDoubleClick(aEvent) {
	if (!myPrefs.newTabByDblclick)
		return;
	if (!getTab(aEvent) && !getClickable(aEvent)) {
		aEvent.view.BrowserOpenTab();
		aEvent.stopPropagation();
	}
}

var baseStyles = new WeakMap();
var platformStyles = new WeakMap();
var fullscreenObservers = new WeakMap();

function onUnload(aEvent) {
	(aEvent.view || aEvent.target.defaultView).addEventListener('unload', onUnload, false);
	uninitWindow(aWindow);
}

function uninitWindow(aWindow) {
	aWindow.removeEventListener('unload', onUnload, false);

	delete aWindow.TabsOnBottom;

	var strip = getTabStrip(aWindow.gBrowser, aWindow);
	strip.removeEventListener('MozMouseHittest', onMozMouseHittest, true);
	strip.removeEventListener('dblclick', onDoubleClick, true);

	baseStyles.delete(aWindow);
	platformStyles.delete(aWindow);

	fullscreenObservers.get(aWindow).destroy();
	fullscreenObservers.delete(aWindow);
}

function handleWindow(aWindow) {
	var doc = aWindow.document;
	if (doc.documentElement.getAttribute('windowtype') != TYPE_BROWSER)
		return;

	aWindow.TabsOnBottom = true;

	var allowedByOtherAddons = Boolean(
			aWindow.TreeStyleTabService
		);
	aWindow.TabsInTitlebar.allowedBy('tabsOnBottom', allowedByOtherAddons);

	baseStyles.set(aWindow, addStyleSheet(baseStyleURL, aWindow));
	platformStyles.set(aWindow, addStyleSheet(platformStyleURL, aWindow));
	fullscreenObservers.set(aWindow, new FullscreenObserver(aWindow));

	var strip = getTabStrip(aWindow.gBrowser, aWindow);
	strip.addEventListener('MozMouseHittest', onMozMouseHittest, true); // to block default behaviors of the tab bar
	strip.addEventListener('dblclick', onDoubleClick, true);

	aWindow.addEventListener('unload', onUnload, false);
}

WindowManager.getWindows(TYPE_BROWSER).forEach(handleWindow);
WindowManager.addHandler(handleWindow);

function shutdown() {
	WindowManager.getWindows(TYPE_BROWSER).forEach(function(aWindow) {
		aWindow.TabsInTitlebar.allowedBy('tabsOnBottom', true);

		aWindow.document.removeChild(baseStyles.get(aWindow));
		aWindow.document.removeChild(platformStyles.get(aWindow));

		aWindow.removeEventListener('unload', onUnload, false);
		uninitWindow(aWindow);
	});

	WindowManager = undefined;
	myPrefs.destroy();
	myPrefs = undefined;
	prefs = undefined;
	baseStyles = undefined;
	platformStyles = undefined;
}
