
var TIMEOUT = {timeout: 10.0};
var ACTION_INFO = 'https://raw.githubusercontent.com/prenagha/launchbar/master/Forecast.lbaction/Contents/Info.plist';
var LB_INFO = 'http://sw-update.obdev.at/update-feeds/launchbar-6.plist';
var LB_DOWNLOAD = 'http://www.obdev.at/products/launchbar/download.html';
var ALERT_ICON = '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertStopIcon.icns';
var CAUTION = 'Caution.icns';
var CHECK = "GreenCheckmark.tiff";

function run(arg) {
  var items = [];
  var good = [];
  var bad = [];
  var error = [];
  loadResult(items, good, bad, error, checkLaunchBar());

  var actionsDir = LaunchBar.homeDirectory + "/Library/Application Support/LaunchBar/Actions";  
  if (Action.preferences.ActionsDir)
    actionsDir = Action.preferences.ActionsDir;

  if (File.isDirectory(actionsDir) && File.isReadable(actionsDir)) {
    LaunchBar.debugLog('Checking actions in ' + actionsDir);
    var actions = File.getDirectoryContents(actionsDir);
    actions.forEach(function(actionPackage) {
      loadResult(items, good, bad, error, checkAction(actionsDir, actionPackage));
    });
  } else {
    error.push({'title': 'Actions dir not accessible'
      ,'subtitle':actionsDir
      ,'alwaysShowsSubtitle': true
      ,'icon':ALERT_ICON});
  }

  items.push({'title': 'Error', badge: ""+error.length, icon:ALERT_ICON, children: error});
  items.push({'title': 'Newer versions available', badge: ""+bad.length, icon:CAUTION, children: bad});
  items.push({'title': 'Up to date', badge: ""+good.length, icon:CHECK, children: good});
  return items;
}

function loadResult(items, good, bad, error, item) {
  if (!item || !item.title)
    return;
  if (item.icon && item.icon == CHECK) {
    good.push(item);
    return;
  }
  if (item.icon && item.icon == CAUTION) {
    bad.push(item);
    return;
  }
  if (item.icon && item.icon == ALERT_ICON) {
    error.push(item);
    return;
  }
  items.push(item);
}

function checkAction(actionsDir, actionPackage) {
  if (!actionPackage.endsWith(".lbaction"))
    return;
  var plistFile = actionsDir + "/" + actionPackage + "/Contents/Info.plist";
  if (!File.exists(plistFile)) {
    return {'title': actionPackage + ': Error Info.plist does not exist'
      ,'subtitle':plistFile
      ,'alwaysShowsSubtitle': true
      ,'icon':ALERT_ICON};
  }
  if (!File.isReadable(plistFile)) {
    return {'title': actionPackage + ': Error Info.plist not readable'
      ,'subtitle':plistFile
      ,'alwaysShowsSubtitle': true
      ,'icon':ALERT_ICON};
  }
    
  var plist = File.readPlist(plistFile);
  var updateURL = getUpdateURL(actionPackage, plist);
  if (updateURL == "SKIP") {
    LaunchBar.debugLog("Skipping " + actionPackage);
    return;
  }
  if (!updateURL || !updateURL.startsWith('http')) {
    return {'title': plist.CFBundleName + ': Update URL missing'
      ,'subtitle': updateURL
      ,'alwaysShowsSubtitle':true
      ,'icon':ALERT_ICON};
  }

  LaunchBar.debugLog(actionPackage + ' URL ' + updateURL);

  var result = {};
  try {  
    result = HTTP.getPlist(updateURL, TIMEOUT);
  } catch (exception) {
    LaunchBar.log('Error ' + actionPackage + ' -- ' + exception);
    return {'title':plist.CFBundleName + ': HTTP Error remote plist ' + exception
      ,'subtitle':updateURL
      ,'alwaysShowsSubtitle': true
      ,'icon':ALERT_ICON
      ,'url':updateURL};
  }

  if (!result) {
    return {'title': plist.CFBundleName + ': Error remote plist empty result'
      ,'subtitle':updateURL
      ,'alwaysShowsSubtitle': true
      ,'icon':ALERT_ICON
      ,'url':updateURL};
  }
  if (result.error) {
    return {'title': plist.CFBundleName + ': Error result remote plist ' + result.error
      ,'subtitle': result.error 
        + (result.response && result.response.status ? " -- " + result.response.status : "")
        + (result.response && result.response.localizedStatus ? " --  " + result.response.localizedStatus : "")
      ,'alwaysShowsSubtitle': true
      ,'icon':ALERT_ICON
      ,'url':updateURL};
  }
  if (!result.data || result.data.length < 1) {
    return {'title': plist.CFBundleName + ': Error remote plist empty data'
      ,'subtitle': updateURL
      ,'alwaysShowsSubtitle': true
      ,'icon':ALERT_ICON
      ,'url':updateURL};
  }
  
  var remoteVer = result.data.CFBundleVersion;
  
  if (plist.CFBundleVersion != remoteVer) {
    return {'title': plist.CFBundleName + ': Newer version available'
      ,'subtitle': plist.CFBundleVersion + ' ➔ ' + remoteVer
      ,'alwaysShowsSubtitle': true
      ,'icon':CAUTION
      ,'url':plist.LBDescription.LBWebsite};
  } else {
    return {'title': plist.CFBundleName + ': up to date'
      ,'subtitle': plist.CFBundleVersion + ' == ' + remoteVer
      ,'alwaysShowsSubtitle': true
      ,'icon': CHECK
      ,'url':plist.LBDescription.LBWebsite};
  }
  
  return [];
}

function getUpdateURL(actionPackage, plist) {
  var actionPrefKey = "UpdateURL" + plist.CFBundleIdentifier.replace(/[^a-zA-Z0-9]/g,'');
  LaunchBar.debugLog("Preferences update URL override for " + actionPackage + ": " + actionPrefKey);
  if (Action.preferences[actionPrefKey] && Action.preferences[actionPrefKey] == "SKIP")
    return "SKIP";
  if (Action.preferences[actionPrefKey] && Action.preferences[actionPrefKey].startsWith('http'))
    return Action.preferences[actionPrefKey];
  if (plist && plist.LBUpdateURL && plist.LBUpdateURL.startsWith('http'))
    return plist.LBUpdateURL;
  if (plist && plist.LBDescription && plist.LBDescription.LBUpdateURL && plist.LBDescription.LBUpdateURL.startsWith('http'))
    return plist.LBDescription.LBUpdateURL;
  if (plist && plist.LBDescription && plist.LBDescription.UpdateURL && plist.LBDescription.UpdateURL.startsWith('http'))
    return plist.LBDescription.UpdateURL;

  if (plist
   && plist.LBDescription 
   && plist.LBDescription.LBWebsite 
   && plist.LBDescription.LBWebsite.includes('github.com/')) {
    var parts = plist.LBDescription.LBWebsite.split('/');
    return 'https://raw.githubusercontent.com/'
      + parts[3] + '/' + parts[4]
      + '/master/'
      + encodeURIComponent(actionPackage)
      + '/Contents/Info.plist';
  }

  return "";
}

function checkLaunchBar() {
  try {
    var result = HTTP.getPlist(LB_INFO, TIMEOUT);
    if (!result) {
      return {'title':'Error checking LaunchBar version - empty result'
        ,'subtitle':'Empty Plist result from ' + LB_INFO
        ,'alwaysShowsSubtitle': true
        ,'icon':ALERT_ICON
        ,'quickLookURL':LB_INFO
        ,'url':LB_INFO};
    }
    if (result.error) {
      return {'title':'Error checking LaunchBar version - ' + result.error
        ,'subtitle':result.error
        ,'alwaysShowsSubtitle': true
        ,'icon':ALERT_ICON
        ,'quickLookURL':LB_INFO
        ,'url':LB_INFO};
    }
    if (!result.data || result.data.length < 1) {
      return {'title':'Error checking LaunchBar version - empty data'
        ,'subtitle':'Empty Plist result data from ' + LB_INFO
        ,'alwaysShowsSubtitle': true
        ,'icon':ALERT_ICON
        ,'quickLookURL':LB_INFO
        ,'url':LB_INFO};
    }
    if (result.data[0].BundleVersion && result.data[0].BundleVersion != LaunchBar.version) {
      return {'title':'LaunchBar: Newer version available'
        ,'subtitle': result.data[0].BundleShortVersionString + ' ➔ ' + LaunchBar.shortVersion
        ,'alwaysShowsSubtitle': true
        ,'quickLookURL':LB_DOWNLOAD
        ,'icon':CAUTION
        ,'url':LB_DOWNLOAD};
    } else {
      return {'title':'LaunchBar: up to date'
        ,'subtitle': LaunchBar.shortVersion + ' == ' + result.data[0].BundleShortVersionString
        ,'alwaysShowsSubtitle': true
        ,'quickLookURL':LB_DOWNLOAD
        ,'icon':CHECK
        ,'url':LB_DOWNLOAD};
    }
  } catch (exception) {
    LaunchBar.log('Error checkLaunchBar ' + exception);
    return {'title':'HTTP Error checking LaunchBar version'
      ,'subtitle':exception
      ,'alwaysShowsSubtitle': true
      ,'icon':ALERT_ICON
      ,'url':LB_INFO};
  }
  return {};
}

function getUpdatePlist(updateURL) {
  var items = [];
  try {
    var result = HTTP.getPlist(updateURL, TIMEOUT);
    if (result && result.data) {
      if (result.data.CFBundleVersion > Action.version) {
        items.push({'title':'Newer version of Forecast action is available'
          ,'subtitle':'Newest is ' + result.data.CFBundleVersion 
            + ' you have ' + Action.version
          ,'icon':'Sun-Low.png'
          ,'url':'https://github.com/prenagha/launchbar/'});
      } else {
        items.push({'title':'Forecast action is up to date'
          ,'subtitle':'Newest is ' + result.data.CFBundleVersion 
            + ' you have ' + Action.version
          ,'icon':'Sun-Low.png'
          ,'url':'https://github.com/prenagha/launchbar/'});
      }
    } else if (result && result.error != undefined) {
      items.push({'title':'Error checking Forecast action version - ' + result.error
        ,'subtitle':result.error
        ,'icon':ALERT_ICON
        ,'url':ACTION_INFO});
    }
  } catch (exception) {
    LaunchBar.log('Error checkVersion ' + exception);
    LaunchBar.alert('Error checkVersion', exception);
  }

  return items;
}
