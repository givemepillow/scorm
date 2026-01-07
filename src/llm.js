var scorm_api = (function() {
    let apiHandle = null;
    let findAPITries = 0;

    function findAPI(win) {
        // Ищем API SCORM 2004
        while ((win.API_1484_11 == null) && (win.parent != null) && (win.parent != win)) {
            findAPITries++;
            if (findAPITries > 500) {
                console.error('Error finding API -- too deeply nested.');
                return null;
            }
            win = win.parent;
        }
        return win.API_1484_11;
    }

    function getAPI() {
        let theAPI = findAPI(window);
        if ((theAPI == null) && (window.opener != null) && (typeof(window.opener) != "undefined")) {
            try {
                theAPI = findAPI(window.opener);
            } catch (e) {}
        }
        return theAPI;
    }

    function getAPIHandle() {
        if (apiHandle == null) {
            apiHandle = getAPI();
        }
        return apiHandle;
    }

    return {
        Initialize: function() {
            let api = getAPIHandle();
            if (api) return api.Initialize('');
            return 'false';
        },
        Terminate: function() {
            let api = getAPIHandle();
            if (api) return api.Terminate('');
            return 'false';
        },
        GetValue: function(name) {
            let api = getAPIHandle();
            if (api) return api.GetValue(name);
            return '';
        },
        SetValue: function(name, value) {
            let api = getAPIHandle();
            if (api) return api.SetValue(name, value);
            return 'false';
        },
        Commit: function() {
            let api = getAPIHandle();
            if (api) return api.Commit('');
            return 'false';
        }
    };
})();