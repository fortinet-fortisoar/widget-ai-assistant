/* Copyright (C) 2008 - 2026 Fortinet Inc.
All rights reserved.
FORTINET CONFIDENTIAL & FORTINET PROPRIETARY SOURCE CODE */


'use strict';

(function () {
    angular
        .module('cybersponse')
        .factory('aiAssistantService', aiAssistantService);

    aiAssistantService.$inject = ['$q', 'API', '$resource', '$interval', '$rootScope', 'playbookService', 'websocketService', 'connectorService', '$http', 'toaster', 'settingsService', 'ViewTemplateService', 'recommendationService', '$filter', '_', 'commonService','$location'];

    function aiAssistantService($q, API, $resource, $interval, $rootScope, playbookService, websocketService, connectorService, $http, toaster, settingsService, ViewTemplateService, recommendationService, $filter, _, commonService, $location) {

        //cache constant messages to avoid recreating the object on every call
        var _cachedMessages = null;
        //cache for getRecommendationSettings results by module
        var _recommendationSettingsCache = {};

        var service = {
            checkIfRecordOpen: checkIfRecordOpen,
            checkPlaybookExecutionCompletion: checkPlaybookExecutionCompletion,
            checkPlaybookExecutionCompletionByPolling: checkPlaybookExecutionCompletionByPolling,
            constantMessages: constantMessages,
            epochToReadable: epochToReadable,
            executeAction: executeAction,
            fetchURL: fetchURL,
            getAllPlaybooks: getAllPlaybooks,
            getArtifacts: getArtifacts,
            getKeyStoreRecord: getKeyStoreRecord,
            getPlaybook: getPlaybook,
            getRecommendationSettings: getRecommendationSettings,
            getUUIDFromURL: getUUIDFromURL,
            getUpdatedURL: getUpdatedURL,
            getUserLoginId: getUserLoginId,
            getUserPreferences: getUserPreferences,
            replaceArtifactsInString: replaceArtifactsInString,
            getAIAssistantConfig: getAIAssistantConfig
        }
        return service;

        function getRecommendationSettings(module) {
            //return cached result if available for this module
            if (_recommendationSettingsCache[module]) {
                return $q.when(_recommendationSettingsCache[module]);
            }
            var recommendationSettings = {};
            return $q.all([settingsService.getSystem(), ViewTemplateService.get('modules-' + module + '-detail')])
                .then(function (results) {
                    recommendationSettings.globalSettings = results[0];
                    recommendationSettings.globalSettings.publicValues.recommendation = recommendationSettings.globalSettings.publicValues.recommendation || {};
                    recommendationSettings.globalSettings.publicValues.recommendation.strategy = angular.isUndefined(recommendationSettings.globalSettings.publicValues.recommendation.strategy) ? 'falconBased' : recommendationSettings.globalSettings.publicValues.recommendation.strategy;
                    var data = results[1];
                    var result = null;
                    if (data.config.workspace && recommendationSettings.strategy !== 'null' && recommendationSettings.strategy !== null) {
                        recommendationSettings.workspace = data.config.workspace;
                        recommendationSettings.workspace.strategy = recommendationSettings.globalSettings.publicValues.recommendation.strategy;
                        result = recommendationSettings;
                    }
                    //cache the result (null included) to avoid repeated API calls
                    _recommendationSettingsCache[module] = result;
                    return result;
                });
        }

        function getArtifacts(text) {
            const htmlTagRegex = /<[^>]*>/g;
            //strip HTML tags from the text before sending for artifact extraction
            const cleanText = text.replace(htmlTagRegex, '');
            return executeAction('cyops_utilities', 'extract_artifacts', null, { data: cleanText });
        }

        function executeAction(connector_name, connector_action, userLoginId, payload) {
            return $resource(API.INTEGRATIONS + 'connectors/?name=' + connector_name)
            .get()
                .$promise
                .then(function (connectorMetaDataForVersion) {
                    return connectorService.executeConnectorAction(connector_name, connectorMetaDataForVersion.data[0].version, connector_action, userLoginId, payload);
                })
                .catch(function (error) {
                    console.error('Error:', error);
                    throw error; // Rethrow the error to be handled by the caller
                });
        }

        //to replace artifacts in give string
        function replaceArtifactsInString(stringToParse, replacements, maskedObjectFactory) {
            constantMessages().keysToMaskArtifactsInOrder.forEach(function (type) {
                var artifacts = replacements[type];
                if (!artifacts) return;
                artifacts.forEach(function (artifact) {
                    //handling a case if a string ends with \
                    artifact = artifact.replace(/\\$/, '');
                    var regex = new RegExp(artifact, 'g');
                    var iocTypeEntry = _.find(maskedObjectFactory.ioc_type, { type: type });
                    if (!iocTypeEntry) {
                        //first entry for this type
                        var typeCount = 1;
                        maskedObjectFactory.ioc_type.push({ type: type, count: typeCount });
                        var key = '{' + type + '-' + typeCount + '}';
                        stringToParse = stringToParse.replace(regex, key);
                        maskedObjectFactory.masked_data[key] = artifact;
                    } else {
                        //check if artifact value already exists in masked_data
                        var existingKey = _.findKey(maskedObjectFactory.masked_data, function (value) {
                            return value === artifact;
                        });
                        if (existingKey) {
                            //reuse existing key
                            stringToParse = stringToParse.replace(regex, existingKey);
                        } else {
                            //increment count and add new key
                            var newCount = ++iocTypeEntry.count;
                            var newKey = '{' + type + '-' + newCount + '}';
                            stringToParse = stringToParse.replace(regex, newKey);
                            maskedObjectFactory.masked_data[newKey] = artifact;
                        }
                    }
                });
            });
            return stringToParse;
        }
        
        
        function poll(_reqConfig, callback) {
            return $interval(function () {
                if (_reqConfig.hasValueReturned) { //check flag before start new call
                    callback(_reqConfig);
                }
                _reqConfig.thresholdValue = _reqConfig.thresholdValue - 1; //Decrease threshold value
                if (_reqConfig.thresholdValue === 0) {
                    stopPoll(_reqConfig); // Stop $interval if it reaches to threshold
                }
            }, _reqConfig.pollInterval);
        }

        function stopPoll(_reqConfig) {
            $interval.cancel(_reqConfig.pollPromise);
            _reqConfig.pollPromise = undefined;
            _reqConfig.thresholdValue = 0; //reset all flags.
            _reqConfig.hasValueReturned = true;
        }

        //If websocket is not active make api calls to check if the playbook execution is completed
        function checkPlaybookExecutionCompletionByPolling(params) {
            var _pollConfig = {
                hasValueReturned: true,
                thresholdValue: 150,
                pollInterval: params.pollInterval || 2000,
                pollPromise: undefined,
                defer: undefined
            };
            _pollConfig.defer = $q.defer();
            _pollConfig.pollPromise = poll(_pollConfig, function (callbackParam) {
                callbackParam.hasValueReturned = false;
                $resource(API.WORKFLOW + 'api/workflows/log_list/?format=json&parent__isnull=True&task_id=' + params.taskId).save({},
                    function (data) {
                        _pollConfig.hasValueReturned = true;
                        if (data['hydra:member'] && data['hydra:member'].length > 0 && (data['hydra:member'][0].status === 'finished' || data['hydra:member'][0].status === 'failed' || data['hydra:member'][0].status === 'terminated')) {
                            stopPoll(callbackParam);
                            _pollConfig.defer.resolve(data['hydra:member'][0]);
                        }
                    },
                    function (error) {
                        statusCodeService(error, true);
                        if (params.callback) {
                            params.callback(error);
                        }
                        stopPoll(callbackParam);
                        _pollConfig.defer.reject(error);
                    });
            });
            if (params.keepPollConfig) {
                playbookPollConfig.push(_pollConfig);
            }
            return _pollConfig.defer.promise;
        }

        //update progress bar using user preference table 
        function checkPlaybookExecutionCompletion(scope){
            var defer = $q.defer();
            getUserPreferences().then(function (response) {
                if (response?.preferences?.genai_metadata?.playbook_gen_progress) {
                    let _percentageCompleted = response.preferences.genai_metadata.playbook_gen_progress; //schema updated as mentioned in connector
                    if(_percentageCompleted === 100){
                        defer.resolve('completed');
                    }
                    else{
                        scope.processCompleted = _percentageCompleted;
                    }
                }   
              });
            return defer.promise;
        }

        function getKeyStoreRecord(queryObject, module) {
            var defer = $q.defer();
            var url = API.QUERY + module;
            $resource(url).save(queryObject, function (response) {
                defer.resolve(response);
            }, function (err) {
                defer.reject(err);
            })
            return defer.promise;
        }

        function getPlaybook(playbookIRI, module) {
            var defer = $q.defer();
            if (playbookService.loadedPlaybookActions && playbookService.loadedPlaybookActions[module]) {
                var _pb = _.find(playbookService.loadedPlaybookActions[module].playbooks, function (pb) {
                    return pb['@id'] === playbookIRI;
                });
                if (_pb) {
                    defer.resolve({ data: _pb });
                    return defer.promise;
                }
            }
            var _playbookId = $filter('getEndPathName')(playbookIRI);
            $http.get(API.BASE + API.WORKFLOWS + _playbookId + '?$relationships=true').then(function (response) {
                defer.resolve(response);
            }, function (error) {
                defer.reject(error);
            });
            return defer.promise;
        }

        function epochToReadable(epochTime) {
            //pad a number with leading zero if less than 10
            function pad(n) {
                return n < 10 ? '0' + n : '' + n;
            }
            var date = new Date(epochTime);
            return date.getFullYear() + '-' +
                pad(date.getMonth() + 1) + '-' +
                pad(date.getDate()) + ' ' +
                pad(date.getHours()) + ':' +
                pad(date.getMinutes()) + ':' +
                pad(date.getSeconds());
        }


        function getAllPlaybooks(queryObject) {
            var defer = $q.defer();
            var url = API.QUERY + 'workflows';
            $resource(url).save(queryObject, function (response) {
                if (response['hydra:member'] && (response['hydra:member'][0])) {
                    defer.resolve(response['hydra:member'][0]['uuid']);
                }
                else {
                    defer.reject("Playbook Not Found");
                    toaster.error({ body: "Playbook not found" });
                }
            }, function (error) {
                defer.reject(error);
            });
            return defer.promise;
        }

        function constantMessages() {
            //return cached object to avoid recreating it on every call
            if (_cachedMessages) {
                return _cachedMessages;
            }
            _cachedMessages = {
                keyStoreProperties: {
                    fortiAIStaticQuestions: {
                        queryParameters: {
                            "sort": [
                                {
                                    "field": "id",
                                    "direction": "ASC",
                                    "_fieldName": "id"
                                }
                            ],
                            "limit": 30,
                            "logic": "AND",
                            "filters": [
                                {
                                    "field": "key",
                                    "operator": "like",
                                    "_operator": "like",
                                    "value": "%fortiai-static-questions%",
                                    "type": "primitive"
                                },
                                {
                                    "sort": [],
                                    "limit": 30,
                                    "logic": "AND",
                                    "filters": []
                                }
                            ],
                            "__selectFields": [
                                "id",
                                "key",
                                "value",
                                "notes",
                                "@id",
                                "@type",
                                "jSONValue"
                            ]
                        },
                        errorMessage: 'fortiai-static-questions key store record not found, refer documentation'
                    },
                    fortiAIConfiguration: {
                        queryParameters: {
                            "sort": [
                                {
                                    "field": "id",
                                    "direction": "ASC",
                                    "_fieldName": "id"
                                }
                            ],
                            "limit": 30,
                            "logic": "AND",
                            "filters": [
                                {
                                    "field": "key",
                                    "operator": "like",
                                    "_operator": "like",
                                    "value": "%fortiai-configurations%",
                                    "type": "primitive"
                                },
                                {
                                    "sort": [],
                                    "limit": 30,
                                    "logic": "AND",
                                    "filters": []
                                }
                            ],
                            "__selectFields": [
                                "id",
                                "key",
                                "value",
                                "notes",
                                "@id",
                                "@type",
                                "jSONValue"
                            ]
                        },
                        errorMessage: 'fortiai-configurations key store record not found, refer documentation'
                    }
                },
                keysToMaskArtifactsInOrder: ['URL', 'Email', 'Domain' , 'Host' , 'IP',  'MD5', 'SHA1', 'SHA256'],
                playbookTags: {
                    pBDesignerSteps: 'aibot-playbookBlockSuggestion'
                },
                botGeneralMessages:{
                    configurationFailedMessage: "Unfortunately, there's not much that can be done at the moment. It seems that the OpenAI integration isn't properly configured or might be encountering issues. We recommend reaching out to your system administrator for assistance.",
                    initialMessage: "Hi there! How can I help you today?",
                    connectorNotConfigured: 'Connector is not configured',
                    defaultConfigurationNotPresent: `Unfortunately, there's not much that can be done at the moment. It seems that the OpenAI integration configuration not set as default. We recommend reaching out to your system administrator for assistance.`,
                    connectorFetchApiFails: 'Error in fetching connector configuration',
                    playbookFailed: "I'm sorry, it seems like there was an issue generating a response. Please try your request again, or refer to the advisor troubleshooting documentation for assistance.",
                    playbookFailedToaster: 'Error in fetching playbook data',
                    proceedingToGenerate: 'Proceeding to generate playbook template.',
                    generatedSuccessfully: 'Playbook template successfully generated! Adding the block now.',
                    buildingDescription: 'Sure, let me build and share a playbook outline to review.',
                    fetchingConversation: 'Loading conversation history',
                    keystorePermissionError: 'The user does not have read permission for the keystore module.',
                    assistantNotFound: 'Assistant not found, run the FortiAI configuration wizard',
                    assistantFailed: 'Failed to fetch assistant',
                    connectorNotAvailable: 'Connector is not available',
                    playbookDesignerInitialMessage: 'Looking to build a playbook? I can help you build a playbook to trigger actions, send alerts, or streamline tasks. What do you want it to do?',
                    connectorInitialMessage: 'Hi there! I can guide you step-by-step to build a connector. Ready to get started?',  
                    similarRecordError:'Similar records could not be loaded, which may affect the GenAI response. Please review the Recommendation Engine settings',
                    pbStepGenerationCompleted:'Playbook generation is complete. Please save the current playbook and clear the conversation to start generating a new playbook.',
                    badGatewayErrorMessage: 'Due to a technical error, the request has timed out. Please clear the conversation and try again',
                    consentErrorMessage: 'You can’t access this widget because you don’t have permission or the AI feature isn’t enabled. Try enabling the feature or contact your administrator for assistance.',
                    agentExecutionFailed: 'Error while executing agent. Please try again'  
                },
                responseProtocol: {
                    recordNavigation: 'fsr_module_navigate',
                    recordCreation: 'fsr_hostname',
                    playbookOutline: 'is_playbook_outline',
                    playbookExecutionLog: 'fsr_new_tab',
                    fileDownload: 'download'
                }
            };
            return _cachedMessages;
        }

        function getUserLoginId(_uuid){
            return $resource(API.AUTH + 'users?uuid=' + _uuid)
            .get()
            .$promise
            .then(function (userLoginDetails) {
                return userLoginDetails;
            })
            .catch(function (error) {
                console.error('Error:', error);
                throw error; // Rethrow the error to be handled by the caller
            });
        }

        /**
        * @ngdoc service
        * @name fortisoar.aiAssistantService
        * @description
        *
        * The `getUserPreferences` gets thread_id from preferences
        *
        **/
        function getUserPreferences() {
            var defer = $q.defer();
            $http.get(API.BASE + 'userpreference').then(function(response) {
                defer.resolve(response.data);
              }, function(err) {
                defer.reject(err);
            });
            return defer.promise;
        }

        //fetch URL from string to navigate
        function fetchURL(latestMessage){
            let str = latestMessage;
            const match = str.match(/\(https:[^\)]+\)/);
            if (match) {
                const matchString = match[0];
                const textInBrackets = matchString.replace(/[()]/g, '');
                str = textInBrackets;
            }
            return str;
        }

        //check if UUID is present in navigation url
        function getUUIDFromURL(url){
            const parts = url.split('/');
            const lastPart = parts[parts.length - 1];
            return lastPart;
        }

        //get updated URL for navigations to be replaced in latest message
        function getUpdatedURL(url, protocol, latestMessage) {
            var protocols = constantMessages().responseProtocol;
            var replacementProtocol = 'https://';

            switch (protocol) {
                case 'recordNavigation':
                    return latestMessage.replaceAll(replacementProtocol + protocols.recordNavigation, '');
                case 'recordCreation':
                    return latestMessage.replaceAll(replacementProtocol + protocols.recordCreation, '');
                case 'playbookExecutionLog':
                    var fullReplacementProtocol = replacementProtocol + protocols.playbookExecutionLog;
                    var hrefLink = '<a href="' + url + '" target="_blank"> <span class="fa fa-external-link" style="color:#20a6af"></span></a>';
                    return latestMessage.replace('(' + fullReplacementProtocol + url + ')', hrefLink);
                default:
                    return latestMessage;
            }
        }

        //function returns boolean true if the current uuid is same as present in navigation URL.
        function checkIfRecordOpen(recordIRI,navigateURL){
            let _urlUUID = getUUIDFromURL(navigateURL);
            let _currentRecordUUID = getUUIDFromURL(recordIRI);
            return _currentRecordUUID === _urlUUID;
        }

        function getAIAssistantConfig() {
            var defer = $q.defer();
                $resource('vendor/config.json').get({}, function (data) {
                    let aiAssistantData = data.aiAssistant || {
                        "allowAgentSelection": false
                    };
                    defer.resolve(aiAssistantData);
                }, function (err) {
                    defer.reject(err);
                });

            return defer.promise;
        }

    }
})();