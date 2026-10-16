/*
 * Looper for YouTube
 * http://www.alvinhkh.com/looperforyoutube
 * Copyright (c) 2011-2016, AlvinHKH
 * http://alvinhkh.com
 * All rights reserved.
 */

to_be_translate = {
	"title": {
		"type": "title",
		"i18n": "extension_name"
	},
	"extension_name": {
		"type": "id",
		"i18n": "extension_name"
	},
	"text_welcome_translation": {
		"type": "id",
		"i18n": "text_welcome_translation",
		"html": true
	},
	"text_support": {
		"type": "id",
		"i18n": "text_support",
		"html": true
	},
	"option_button": {
		"type": "option"
	},
	"option_button_icon": {
		"type": "id"
	},
	"option_button_iconandtext": {
		"type": "id"
	},
	"option_button_text": {
		"type": "id"
	},
	"option_loop_manual": {
		"type": "option",
		"i18n": "option_manual_loop"
	},
	"option_loop_savestate": {
		"type": "option",
		"i18n": "option_savestate_loop"
	},
	"option_loop_auto": {
		"type": "option",
		"i18n": "option_auto_loop"
	},
	"ytShortcut": {
		"type": "option",
		"i18n": "option_keyboard_shortcut_loop"
	},
	"ytLoopPanel": {
		"type": "option",
		"i18n": "option_advanced_panel"
	},
	"title_extra_features": {
		"type": "id",
	},
	"option_small_size": {
		"type": "id"
	},
	"option_large_size": {
		"type": "id"
	},
	"option_full_size": {
		"type": "id"
	},
	"ytQuality": {
		"type": "option",
		"i18n": "option_auto_quality"
	},
	"option_auto": {
		"type": "id"
	},
	"text_experimental": {
		"type": "id"
	},
	"text_not_compatible": {
		"type": "id"
	},
"title_feedback": {
		"type": "id"
	},
	"text_feedback": {
		"type": "id"
	},
	"chrome_web_store": {
		"type": "id"
	},
	"title_changelog": {
		"type": "id"
	},
	"text_full_changelog": {
		"type": "id"
	},
	"text_extension_by": {
		"type": "id"
	},
	"text_version": {
		"type": "id"
	},
}
/*
 * Function to translate to_be_translate
 */
var message = chrome.i18n.getMessage;
function translation(translate) {
	for (var element in translate) {
		var _element = null,
			type = translate[element].type,
			i18n = translate[element].i18n,
			isHtml = translate[element].html == true ? true : false;
		i18n = (i18n == null || i18n == "") ? element.toString() : i18n;
		switch (type) {
		case 'title':
			document.title = message(i18n);
			break;
		case 'option':
			_element = document.getElementById(element);
			if (_element && _element.parentElement)
			_element.parentElement.getElementsByTagName('span')[0].innerText = message(i18n);
			break;
		case 'id':
		default:
			_element = document.getElementById(element);
            if (_element != null)
			if (isHtml) {
				_element.innerHTML = message(i18n);
			} else {
				_element.innerText = message(i18n);
			}
			break;
		}
	}
}
/*
 * Function to show save message
 */
function showMessage(msg) {
	msg = msg ? msg : message('message_saved');
	document.getElementById('message_text').innerText = msg;
	setTimeout(function (){document.getElementById('message_text').innerHTML = "&nbsp;";}, 1000);
}

window.addEventListener ('DOMContentLoaded', function() {

if (self.location.search != '?embedded' || navigator.userAgent.match(/OPR\//) != null)
	document.body.className = document.body.className.replace(/( )?embedded/g, '');
if (self.location.search != '?embedded') {
	var element = document.createElement("link");
	if (typeof(element) != "undefined") {
		element.setAttribute("rel", "stylesheet");
		element.setAttribute("type", "text/css");
		element.setAttribute("media", "all");
		element.setAttribute("href", "options_input.css");
		document.getElementsByTagName("head")[0].appendChild(element);
	}
}

translation(to_be_translate);

// Get Options From Chrome-Sync via Chrome Storage API
try {
	chrome.storage.onChanged.addListener(function(changes, namespace) {
		for (const key in changes) {
			if (!Object.prototype.hasOwnProperty.call(changes, key)) continue;
			var storageChange = changes[key];
			var newValue;
			if (storageChange.newValue) {
				newValue = storageChange.newValue.toString();
			}
			if (key == 'ytAutoLoop') {
				document.getElementById('option_loop_manual').checked = false;
				document.getElementById('option_loop_savestate').checked = false;
				document.getElementById('option_loop_auto').checked = false;
				switch (newValue) {
				case 'true':
				case true:
					document.getElementById('option_loop_auto').checked = true;
					break;
				case 'saveState':
					document.getElementById('option_loop_savestate').checked = true;
					break;
				case 'false':
				case false:
				default:
					document.getElementById('option_loop_manual').checked = true;
					break;
				}
			}
			if (key == 'option_button' && document.getElementById(key))
				document.getElementById(key).value = newValue;
			if (key == 'ytShortcut' && document.getElementById(key))
				document.getElementById(key).checked = (newValue == 'true');
			if (key == 'ytShortcutKey' && document.getElementById(key))
				document.getElementById(key).value = (newValue && /^[a-z]$/i.test(newValue)) ? newValue.toLowerCase() : 'p';
			if (key == 'ytLoopPanel' && document.getElementById(key))
				document.getElementById(key).checked = (newValue == 'true');
			if (key == 'ytQuality' && document.getElementById(key))
				document.getElementById(key).value = newValue;
		}
	});
	chrome.storage.sync.get(null, function(value){
		switch(value['ytAutoLoop']) {
			case 'true':
			case 'false':
			case 'saveState':
				sessionStorage['option_auto_loop'] = value['ytAutoLoop']; 
				break;
			default: 
				sessionStorage['option_auto_loop'] = 'false'; 
				break;
		}
		switch(value['option_button']) {
			case 'all':
			case 'icon':
			case 'text':
				sessionStorage['option_button'] = value['option_button']; 
				break;
			default: 
				sessionStorage['option_button'] = 'all'; 
				break;
		}
		sessionStorage['ytShortcut'] = value['ytShortcut'] ? ( value['ytShortcut']=='false' ? 'false' : 'true' ) : 'true';
		sessionStorage['ytShortcutKey'] = (value['ytShortcutKey'] && /^[a-z]$/i.test(value['ytShortcutKey'])) ? value['ytShortcutKey'].toLowerCase() : 'p';
		sessionStorage['ytLoopPanel'] = value['ytLoopPanel'] ? ( value['ytLoopPanel']=='false' ? 'false' : 'true' ) : 'true';
		switch(value['ytQuality']) {
			case 'highres':
			case 'hd2880':
			case 'hd2160':
			case 'hd1440':
			case 'hd1080':
			case 'hd720':
			case 'large':
			case 'medium':
			case 'small':
			case 'tiny':
			case 'default':
				sessionStorage['ytQuality'] = value['ytQuality']; 
				break;
			default: 
				sessionStorage['ytQuality'] = 'disabled'; 
				break;
		}
		// Reset Sync Storage
		chrome.storage.sync.clear();
		chrome.storage.sync.set({
			ytAutoLoop: sessionStorage['option_auto_loop'],
			option_button: sessionStorage['option_button'],
			ytShortcut: sessionStorage['ytShortcut'],
			ytShortcutKey: sessionStorage['ytShortcutKey'],
			ytLoopPanel: sessionStorage['ytLoopPanel'],
			ytQuality: sessionStorage['ytQuality']
		}, function(){});
	});
} catch (e) {
	console.log('ERROR: YOUR BROWSER DO NOT SUPPORT CHROME.STORAGE API');
}

// Click Actions - Save Options
document.getElementById('option_loop_manual').addEventListener ('click', function(){
	var id = 'option_loop_manual',
		newValue = document.getElementById(id).value;
	if (!document.getElementById(id)) return false;
	if(chrome.storage) chrome.storage.sync.set({ytAutoLoop: newValue.toString()}, showMessage);
}, false);
document.getElementById('option_loop_savestate').addEventListener ('click', function(){
	var id = 'option_loop_savestate',
		newValue = document.getElementById(id).value;
	if (!document.getElementById(id)) return false;
	if(chrome.storage) chrome.storage.sync.set({ytAutoLoop: newValue.toString()}, showMessage);
}, false);
document.getElementById('option_loop_auto').addEventListener ('click', function(){
	var id = 'option_loop_auto',
		newValue = document.getElementById(id).value;
	if (!document.getElementById(id)) return false;
	if(chrome.storage) chrome.storage.sync.set({ytAutoLoop: newValue.toString()}, showMessage);
}, false);
document.getElementById('option_button').addEventListener ('change', function(){
	var id = 'option_button',
		newValue = document.getElementById(id).value;
	if (!document.getElementById(id)) return false;
	switch(newValue) {
		case 'all':
		case 'icon':
		case 'text':
			break; 
		default: 
			newValue = 'all'; 
			break;
	}
	if(chrome.storage) chrome.storage.sync.set({option_button: newValue.toString()}, showMessage);
}, false);
document.getElementById('ytShortcut').addEventListener ('click', function(){
	var id = 'ytShortcut',
		newValue = document.getElementById(id).checked;
	if (!document.getElementById(id)) return false;
	if(chrome.storage) chrome.storage.sync.set({ytShortcut: newValue.toString()}, showMessage);
}, false);
document.getElementById('ytShortcutKey').addEventListener ('change', function(){
	var id = 'ytShortcutKey',
		newValue = document.getElementById(id).value.trim().toLowerCase();
	if (!document.getElementById(id)) return false;
	if (!newValue || !/^[a-z]$/.test(newValue)) newValue = 'p';
	document.getElementById(id).value = newValue;
	if(chrome.storage) chrome.storage.sync.set({ytShortcutKey: newValue}, showMessage);
}, false);
document.getElementById('ytLoopPanel').addEventListener ('click', function(){
	var id = 'ytLoopPanel',
		newValue = document.getElementById(id).checked;
	if (!document.getElementById(id)) return false;
	if(chrome.storage) chrome.storage.sync.set({ytLoopPanel: newValue.toString()}, showMessage);
}, false);
document.getElementById('ytQuality').addEventListener ('change', function(){
	var id = 'ytQuality',
		newValue = document.getElementById(id).value;
	if (!document.getElementById(id)) return false;
	switch(newValue) {
		case 'highres':
		case 'hd2880':
		case 'hd2160':
		case 'hd1440':
		case 'hd1080':
		case 'hd720':
		case 'large':
		case 'medium':
		case 'small':
		case 'tiny':
		case 'default':
			break; 
		default: 
			newValue = 'disabled'; 
			break;
	}
	if(chrome.storage) chrome.storage.sync.set({ytQuality: newValue.toString()}, showMessage);
}, false);
if (typeof ( chrome.runtime ) == 'object' && typeof ( chrome.runtime.getManifest ) == 'function') {
	// Get Version Number
	document.getElementById('version').innerText = chrome.runtime.getManifest().version;
	document.getElementById('versionGroup').style.display = 'inline';
}

}, false);