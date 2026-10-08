/* Copyright (C) 2008 - 2026 Fortinet Inc.
All rights reserved.
FORTINET CONFIDENTIAL & FORTINET PROPRIETARY SOURCE CODE */
'use strict';
(function () {
  angular
    .module('cybersponse')
    .controller('aiAssistant600Ctrl', aiAssistant600Ctrl);

  aiAssistant600Ctrl.$inject = ['$scope', 'toaster', '$rootScope', '$q', '$timeout', 'localStorageService', 'aiAssistantService', '$window', '$state', 'widgetBasePath', 'Modules', '$filter', 'currentPermissionsService', 'FormEntityService', 'playbookService', 'usersService', '$location', 'IMAGE_TYPES', 'aiAgentsService', 'settingsService', '$uibModal', 'widgetService', 'CommonUtils', 'websocketService', 'COMMENT_TYPES'];

  function aiAssistant600Ctrl($scope, toaster, $rootScope, $q, $timeout, localStorageService, aiAssistantService, $window, $state, widgetBasePath, Modules, $filter, currentPermissionsService, FormEntityService, playbookService, usersService, $location, IMAGE_TYPES, aiAgentsService, settingsService, $uibModal, widgetService, CommonUtils, websocketService, COMMENT_TYPES) {

    var widgetBasePath = widgetBasePath;
    var constantMessages = aiAssistantService.constantMessages();
    //use cached constantMessages instead of calling aiAssistantService.constantMessages() repeatedly
    var responseProtocol = constantMessages.responseProtocol;
    var botGeneralMessages = constantMessages.botGeneralMessages;
    const INSIGHT = 'insight';
    //Message type constants for conversation messages
    const MSG_TYPE_USER = 'user';
    const MSG_TYPE_BOT = 'bot';
    const MSG_TYPE_BOT_GENERAL = 'botGeneral';
    const currentTimeStamp = new Date();
    const initialBotMessage = {
      socAssitantConversation: [{
        text: constantMessages.botGeneralMessages.initialMessage,
        type: 'botGeneral',
        timestamp: currentTimeStamp
      }],
      pbAssistantConversation: [{
        text: constantMessages.botGeneralMessages.playbookDesignerInitialMessage,
        type: 'botGeneral',
        timestamp: currentTimeStamp
      }],
      connectorAssistantConversation: [{
        text: constantMessages.botGeneralMessages.connectorInitialMessage,
        type: 'botGeneral',
        timestamp: currentTimeStamp
      }]
    };
    $scope.currentTheme = $rootScope.theme.id;
    $scope.messages = loadDataFromLocalStorage() || angular.copy(initialBotMessage);
    $scope.pageState = $state;
    
    $scope.playbookDescription = '';
    $scope.showDescription = false;//To append review results button to the bot text, button only visible on playbook description
    $scope.processingConversation = false;
    $scope.pbDesignerPage = false;
    $scope.disableTextArea = true;
    //Locks the conversation area on the playbook designer page once PB steps
    //have been pasted into the designer canvas. Stays locked until the user
    //explicitly clears the conversation (see clearConversation).
    $scope.disableConversationInDesigner = checkPlaybookGenerationStatus() || false;
    $scope.showStaticQuestions = false;
    $scope.playbookPermission = currentPermissionsService.getPermission('workflows');
    $scope.listOfQuestions = {};
    $scope.recommendationSettings = {};
    $scope.suggestedPlaybooksList = [];
    $scope.isLightTheme = $rootScope.theme.id === 'light';
    $scope.backgroundImageUrl = $scope.isLightTheme ? widgetBasePath + 'images/assistant-ui-white-background.svg' : widgetBasePath + 'images/assistant-ui-dark-background.svg';
    $scope.bulbIcon = $scope.isLightTheme ? widgetBasePath + 'images/bulb-light.svg' : widgetBasePath + 'images/bulb-dark.svg';
    $scope.traceFlowBtn = `${widgetBasePath}${$scope.isLightTheme ? 'images/trace-flow-btn-icon-light.svg' : 'images/trace-flow-btn-icon.svg'}`;
    $scope.copyIcon = `${widgetBasePath}${$scope.isLightTheme  ? 'images/ic_copy_light.svg' : 'images/ic_copy.svg'}`;
    $scope.botIcon = `${widgetBasePath}${$scope.isLightTheme  ? 'images/bot_light.svg' : 'images/bot.svg'}`;
    $scope.playbookTags = {
      pBDesignerSteps: [constantMessages.playbookTags.pBDesignerSteps]
    };
    $scope.jsonOptions = {
      mode: 'view',
      modes: ['view','preview'],
      'enableTransform': true,
      'enableSort': false
    };
    $scope.pbOptions = {
      'name': 'Workflow Steps',
      mode: 'form',
      modes: ['code', 'form'],
      'enableTransform': true,
      'enableSort': false
    };
    $scope.configForMarkdown = {
      initialEditType: 'markdown',
      previewStyle: 'tab',
      height: '420px',
      usageStatistics: false,
      hideModeSwitch: true,
      toolbarItems: ['']
    };
    $scope.userInput = {
      textVal: ''
    };
    $scope.inputText = {
      inputText: '',
    };
    $scope.processCompleted = 6; //variables for playbook percentage loader
    $scope.staticQuestionsPresent = false;
    $scope.textAreaActionsTriggered = textAreaActionsTriggered;
    $scope.inRecordDetailedView = false;
    $scope.finalTranscript = '';
    $scope.conversationTextUpdated = conversationTextUpdated;
    $scope.imageTypes = IMAGE_TYPES;
    $scope.activeAssistant = '';
    $scope.clearConversationTooltip = 'Click to clear conversation';
    $scope.copyConversationTooltip = 'Click to copy conversation';
    $scope.isInsightPresent = false;
    $scope.aiFeatureEnabled = false;
    const initTokenByAssistant = {
      soc: '',
      pb: '',
      connector: '',
      insight: ''
    }
    $scope.tokenByAssistant = localStorageService.get('aiAssistantBot.tokens') || initTokenByAssistant;
    updateTokenTooltip($scope.tokenByAssistant);

    //function calls
    $scope.updateJsonOutline = updateJsonOutline;
    $scope.clearConversation = clearConversation;
    $scope.copyConversation = copyConversation;
    $scope.generatePlaybook = generatePlaybook;
    $scope.openDocumentation = openDocumentation;
    $scope.adjustTextareaHeight = adjustTextareaHeight;
    $scope.hideQuestionsPopUp = hideQuestionsPopUp;
    $scope.processSelectedQuestion = processSelectedQuestion;
    $scope.loadTraceFlow = loadTraceFlow;
    $scope.copyMessageContent = copyMessageContent;
    $scope.addAsComment = addAsComment;

    var selectedQuestion = '';
    var stateChangeSuccess = '';
    var keyStoreJSONValue = {};
    var staticQuestionsModule = [];
    var maskedObjects = { emails: {}, urls: {}, domains: {}, ips: {}, hashes: {}, sha256: {}, sha1: {}, md5: {} };
    var maskedObjectFactory = { ioc_type: [], masked_data: {} }; //to store the masked object in userPref
    var recordMetadata = {}; //to create records and field data
    var record_data = {}; // to create records and fieldOfInterest data to pass in payload
    var currentModule = undefined;
    var currentModuleId = undefined;
    var keyStoreProperties = constantMessages.keyStoreProperties;
    var user = usersService.getCurrentUser();
    const currentUserId = user.userId;
    const userUUID = user.uuid;
    var userLoginId = '', recordIRI = '', previousRecordIRI = '';
    var socThreadId = loadThreadsFromLocalStrorage()?.socThreadId || '';
    var connectorThreadId = loadThreadsFromLocalStrorage()?.connectorThreadId || '';
    var insightThreadId = loadThreadsFromLocalStrorage()?.insightThreadId || '';
    var messageHistory;
    var aiConfiguration = {};
    var staticQuestionPopUpShown = false;
    var record_context_updated = false;
    var keystorePermission = currentPermissionsService.getPermission('keys');
    var dt = new Date();
    var pbParameters = new Object();
    var insightExploration = false; // to show insight exploration 
    var webSocketSubscription;

    const TIMEZONE_OFFSET = dt.getTimezoneOffset();
    const PROGRESS_BAR_INTERVAL = 3000;

    //for testing purpose and will be removed from current scope 8.0.1
    $scope.AGENT_SELECTION = [{
      'title': 'Playbook Agent',
      'name': 'playbook-generator'
    },{
      'title': 'SOC Agent',
      'name': 'conversation'
    },{
      'title': 'Connector Agent',
      'name': 'connector-generation'
    },{
      'title': 'Orchestrator Agent',
      'name': 'orchestrator'
    }
  ];

    $scope.agent = {
      inUse: 'conversation'
    };
    const ACTIVE_PAGE_CONFIG = {
      'main.marketplace.workspace': {
        assistant: 'connector',
        agent: 'connector-generation',
        threadId: () => connectorThreadId
      },

      'main.playbookDetail': {
        assistant: 'pb',
        agent: 'playbook-generator',
        threadId: () => pbParameters.pbGenerationThreadId || pbParameters.pbConversationThreadId
      },

      [INSIGHT]: {
        assistant: INSIGHT,
        agent: 'conversation',
        threadId: () => insightThreadId
      },

      default: {
        assistant: 'soc',
        agent: 'conversation',
        threadId: () => socThreadId
      }
    };

    const INTERVAL_POLLING_TIME = 5000;

    init();

    function getAIConsentStatus() {
      if (angular.isFunction(settingsService.getAIConsentStatus)) {
        settingsService.getAIConsentStatus()
          .then(function (response) {
            if (response) {
              $scope.aiFeatureEnabled = response;
              initializeAssistantData();
            } else {
              $scope.aiFeatureEnabled = false;
              $scope.consentErrorMessage = botGeneralMessages.consentErrorMessage;
            }
          })
          .catch(function () {
            $scope.aiFeatureEnabled = false;
            $scope.consentErrorMessage = botGeneralMessages.consentErrorMessage;
          });
      } else {
        // Backward compatibility for older versions where API is unavailable
        $scope.aiFeatureEnabled = true;
        initializeAssistantData();
      }
    }
    
    function init() {
      $rootScope.isAIAssistantOpen = true;
      getAIConsentStatus();
    }

    function initializeAssistantData(){
      loadConfigJson();
      if (keystorePermission.read) {
        if(localStorageService.get('exploreInsight')){
          insightExploration = true;
        }
        if (insightExploration) {
          hideLoaders();
          if(loadThreadsFromLocalStrorage()?.insightThreadId){
            updateModuleDataOnEventChange($scope.pageState.current, $scope.pageState.current.params);
          }
        }
        else {
          $q.all([loadUserLoginDetails(), loadKeyStoreData()]).then((response) => {
            stateChangeSuccessFunction(); //to activate the stateChange listener on init
            updateModuleDataOnEventChange($scope.pageState.current, $scope.pageState.current.params);
            setPlaybookParameters();
            hideLoaders();
          }, function () {
            hideLoaders();
          });
        }
      }
      else{
        clearConversationText(getActiveParameters().assistant);
        pushMessage(
          getActiveParameters().assistant,
          botGeneralMessages.keystorePermissionError,
          MSG_TYPE_BOT_GENERAL,{ errorPresent : true}
        );
        hideLoaders();
      }
    }

    function loadConfigJson(){
      // read config.json 
          aiAssistantService.getAIAssistantConfig().then(function(response){
                $scope.allowAgentSelection = response.allowAgentSelection || false;
          })
    }

    function setPlaybookParameters() {
      pbParameters = {
        pbGenerationThreadId: loadThreadsFromLocalStrorage()?.pbGenerationThreadId || '', //for playbook outline generation
        pbConversationThreadId: loadThreadsFromLocalStrorage()?.pbConversationThreadId || '', //for playbook Conversation
        conversation_type : '', //generate PB outline in conversation
        outline_data: '',
        response_json: {},
        result_list: {},
        current_step: {},
        input_params: {},
        is_pb_steps_conversation: false, //true only when conversation starts after pb generation is active
        playbook_content: ''
      }
    }

    function loadUserLoginDetails(){
      var defer = $q.defer();
      aiAssistantService.getUserLoginId(currentUserId).then(function (userLoginDetails) {
        if (userLoginDetails && userLoginDetails.usersresp && userLoginDetails.usersresp[0].loginid) {
          userLoginId = userLoginDetails.usersresp[0].loginid;
          defer.resolve();
        }
      }, function (error) {
        console.log(error);
        hideLoaders();
      });
      return defer.promise;
    }

    function loadKeyStoreData(){
      var defer = $q.defer();
      aiAssistantService.getKeyStoreRecord(keyStoreProperties.fortiAIStaticQuestions.queryParameters, 'keys').then(function (response) {
        if (response['hydra:member'] && (response['hydra:member'][0])) {
          keyStoreJSONValue = response['hydra:member'][0].jSONValue;
          staticQuestionsModule = Object.keys(keyStoreJSONValue['modules']);
          defer.resolve();
        }  else {
          toaster.error({ body: keyStoreProperties.fortiAIStaticQuestions.errorMessage });
          hideLoaders();
        }
      });
      return defer.promise;     
    }

    function fetchStaticQuestions(currentModule) {
      const moduleData = keyStoreJSONValue.modules[currentModule];
      $scope.listOfQuestions = {};
      $scope.fieldsOfInterest = [];
      $scope.staticQuestionsPresent = false;
      if (!moduleData) {
        return;
      }
      if (moduleData.questions && moduleData.questions.length > 0) {
        moduleData.questions.forEach(function (question) {
          if (question.enabled) {
            $scope.listOfQuestions[question.question] = question.description || '';
          }
        });

        $scope.staticQuestionsPresent = Object.keys($scope.listOfQuestions).length > 0;
      }

      if (moduleData.fieldsOfInterest && moduleData.fieldsOfInterest.length > 0) {
        $scope.fieldsOfInterest = moduleData.fieldsOfInterest;
      }
    }

    function processSelectedQuestion(selectedMessage) {
      $scope.processingConversation = true;
      hideQuestionsPopUp(true);
      selectedQuestion = selectedMessage;
      var _selectedQuestion = keyStoreJSONValue['modules'][$scope.pageState.current.params.module]['questions'][Object.entries($scope.listOfQuestions).findIndex(([key, value]) => key === selectedQuestion)];
      $scope.userInput.textVal = _selectedQuestion.question;
      pushMessage(getActiveParameters().assistant, _selectedQuestion.question, MSG_TYPE_USER);
      agentConversation();
      scrollToBottom();
    }

    //to export playbook json
    function _exportPlaybook(state) {
      const _uuid = aiAssistantService.getUUIDFromURL(state.ncyBreadcrumbLink);
      var query = {
        module: 'workflows',
        'uuid$in': $filter('getEndPathName')(_uuid),
        $relationships: true,
        $export: true
      };

      Modules.get(query).$promise.then(function (response) {
        playbookService.preparePlaybookforExport(response['hydra:member'], true).then(function (response) {
          if (response && response.data) {
            pbParameters.playbook_content = response.data;
          }
        });
      });
    }
    $scope.getOriginalRecord = function () {
      var records = [];
      records.push({
        '@id': $scope.entity.originalData['@id']
      });
      return records;
    };

    function stateChangeSuccessFunction() {
      stateChangeSuccess = $scope.$on('$stateChangeSuccess', function (event, toState, toParams, from, fromParams) {
        updateModuleDataOnEventChange(toState,toParams); //update parameters on state change
      });
    }

    //update all module related data as per current state and params
    function updateModuleDataOnEventChange(state,params,insight){
      $scope.userInput.textVal = '';
      if(!$scope.allowAgentSelection){
        setAgentInUse();
      }
      record_context_updated = false;
      recordIRI = '';
      previousRecordIRI = '';
      $scope.activeAssistant = getActiveParameters().assistant;
      if (insightExploration) {
        insightThreadId = loadThreadsFromLocalStrorage()?.insightThreadId || '';
        if ((insight && insight.type === INSIGHT)) {
          currentModule = INSIGHT;
          exploreInsight(insight);
        } else {
          $scope.messages = loadDataFromLocalStorage();
        }
      }
      else if (state.name.includes('main.playbookDetail')) {
        $scope.pbDesignerPage = true;
        currentModule = 'main.playbookDetail';
        pbParameters.conversation_type = 'pb_outline';
        _exportPlaybook(state);
        updateConversationMessages(getActiveParameters().assistant);
      }
      else {
        $scope.pbDesignerPage = false;
        pbParameters.conversation_type = '';
        pbParameters.is_pb_steps_conversation = false;
        if (state.name.includes('viewPanel.modulesDetail') && staticQuestionsModule.includes(params.module)) {
          $scope.entity = FormEntityService.get();
          currentModule = params.module;
          currentModuleId = params.id;
          if (!angular.isUndefined($scope.entity) && !angular.isUndefined($scope.entity.originalData['@id'])) {
            recordIRI = $scope.entity.originalData['@id'];
            previousRecordIRI === recordIRI ? record_context_updated = false : record_context_updated = true;
            previousRecordIRI = recordIRI;
          }

          record_context_updated = true;
          $scope.inRecordDetailedView = true;
          aiAssistantService.getRecommendationSettings($scope.pageState.current.params.module).then(function (response) {
            $scope.recommendationSettings = response;
          });
          fetchStaticQuestions(params.module);
          if(!staticQuestionPopUpShown){
            hideQuestionsPopUp(false);
          }
        }
        else{
          $scope.inRecordDetailedView = false;
        }
      updateConversationMessages(getActiveParameters().assistant);
      }
    }
    
    function hideQuestionsPopUp(hide) {
      const customModal = document.getElementById('record-static-questions');
      if (hide) {
        customModal.setAttribute('style', 'display:none;');
        // $timeout(function () {
        //   scrollToBottom(); 
        // });
      }
      else {
        customModal.setAttribute('style', 'display:inline-block;');
        adjustTextareaHeight(true);
        staticQuestionPopUpShown = true;
      }
    }

    $scope.$on('popupOpened', function (event, data, insight) {
      if (data === $scope.config.name + '_' + $scope.config.version) {
        $rootScope.isAIAssistantOpen = true;
        if(getActiveParameters().assistant === INSIGHT){
          clearConversationText(getActiveParameters().assistant);
        }
        stateChangeSuccessFunction(); //to activte the stateChange listener on pop-up open       
        $scope.isLightTheme = $rootScope.theme.id === 'light';
        $scope.backgroundImageUrl = $scope.isLightTheme ? widgetBasePath + 'images/assistant-ui-white-background.svg' : widgetBasePath + 'images/assistant-ui-dark-background.svg';
        updateModuleDataOnEventChange($scope.pageState.current, $scope.pageState.current.params, insight); //as state change doesn't fire on 
      }
    })

    $scope.$on('popupClosed', function (event, data) {
      if (data === $scope.config.name + '_' + $scope.config.version) {
        $rootScope.isAIAssistantOpen = false;
        //to destroy the stateChange listener on pop-up close
        stateChangeSuccess(); 
      }
    })

    $scope.$on('$destroy', function () {
      if (getActiveParameters().assistant === INSIGHT) {
        delete $scope.messages.insightConversation;
        updateLocalStorageData();
      }
      $rootScope.isAIAssistantOpen = false;
      localStorageService.remove('exploreInsight');
      stateChangeSuccess();
    });

    //***************** local storage function block ******************//
    function loadDataFromLocalStorage() {
      return JSON.parse(localStorageService.get('aiAssistantBot.messages'));
    }

    function loadThreadsFromLocalStrorage(){
      return JSON.parse(localStorageService.get('aiAssistantBot.threadIds'));
    }

    function updateLocalStorageData() {
      localStorageService.set('aiAssistantBot.messages', JSON.stringify($scope.messages));
    }

    //update all application thread ids in local storage
    function updateThreadIdInLocalStorage() {
      localStorageService.set('aiAssistantBot.threadIds', JSON.stringify({
        socThreadId: socThreadId,
        pbGenerationThreadId: pbParameters.pbGenerationThreadId,
        pbConversationThreadId: pbParameters.pbConversationThreadId,
        connectorThreadId: connectorThreadId,
        insightThreadId: insightThreadId 
      }));
    }

    function loadSessionsFromLocalStorage(){
      return localStorageService.get('aiAssistantBot.sessionData');
    }

    function checkPlaybookGenerationStatus(){
      return $scope.messages.pbAssistantConversation.some(function(message) {
            return message && message.playbookGenerationComplete === true;
      });
    }

    function disablePlaybookGeneration() {
      $scope.messages.pbAssistantConversation.forEach(function (message) {
        if (message && message.isJSONFormat === true) {
          message.disabled = true;
        }
      });
    }

    //scroll to bottom when new conversation message is added.
    //We wait for the next animation frame because the new message is pushed
    //to the conversation model and Angular re-renders it before the browser
    //has painted — reading scrollHeight synchronously would return the
    //pre-update value. If the layout is still settling (e.g. markdown /
    //images still rendering), retry on the next frame until scrollHeight
    //stops growing.
    function scrollToBottom() {
      var container = document.getElementById('bot-conversation-body');
      if (!container) {
        return;
      }
      var lastHeight = -1;
      function scrollStep() {
        // Bail out if the widget was torn down between frames.
        if (!container.isConnected) {
          return;
        }
        var currentHeight = container.scrollHeight;
        container.scrollTop = currentHeight;
        // Layout has settled — stop scrolling further frames.
        if (currentHeight === lastHeight) {
          return;
        }
        lastHeight = currentHeight;
        requestAnimationFrame(scrollStep);
      }
      requestAnimationFrame(scrollStep);
    }

    function conversationTextUpdated(){
      if($scope.userInput.textVal === ''){
        $scope.finalTranscript = '';
      }
    }

    function adjustTextareaHeight(fromKeypress) {
      var textarea = document.getElementById('conversation-text-input');
      // Conversation body height is controlled by flexbox (#ai-assistant-bot
      // is a flex column, #bot-conversation-body uses flex: 1 1 auto with
      // min-height: 0 and overflow-y: auto). Only the textarea grows.
      if (fromKeypress) {
        textarea.style.height = "auto"; // Reset textarea height
        textarea.style.height = (textarea.scrollHeight) + "px"; // Set new height
      }
      else {
        textarea.style.height = "46px";
      }
      scrollToBottom();
    };

    var previousResponseByAssistant = {
      soc: '',
      pb: '',
      connector: '',
      insight: ''
    };
    var previousRequestByAssistant = {
      soc: '',
      pb: '',
      connector: '',
      insight: ''
    };
    var sessionIdByAssistant = loadSessionsFromLocalStorage() || {
      soc: '',
      pb: '',
      connector: '',
      insight: ''
    }
    var previous_pb_context = '';
    //generate response if enter is pressed in textbox
    $scope.sendMessage = function (event, flagEnterClick) {
      //if conversation option is selected
      if (((event.keyCode === 13 && !event.shiftKey) || flagEnterClick) && ($scope.userInput.textVal && $scope.userInput.textVal !== '')) {
        event.preventDefault();
        const _textArea = document.getElementById('conversation-text-input');
        _textArea.blur();
        var _index = 0;
        var jsonString = '';
        $scope.processingConversation = true;
        if (currentModule === INSIGHT) {
            pushMessage(getActiveParameters().assistant, $scope.userInput.textVal, MSG_TYPE_USER);
            agentConversation();
        }
        else {
          var assistant = getActiveParameters().assistant;
          pushMessage(assistant, $scope.userInput.textVal, MSG_TYPE_USER);
          _index = $scope.getActiveConversation().length;
          jsonString = JSON.stringify(angular.copy($scope.getActiveConversation()[_index - 1].text));
          record_data = {};
          agentConversation();
        }
        $scope.finalTranscript = '';
        $scope.userInput.textVal = '';
        $timeout(function () {
          adjustTextareaHeight(false);
        });
      }
    };

    //step-by-step playbook generation on generate button clicked
    function generatePlaybook(message) {
      message.disabled = true;
      $scope.processingConversation = true;
      $scope.userInput.textVal = '';
      agentConversation();
    }

    //check if returned message has navigation present and then navigate to that URL
    function checkIfNavigationPresent(latestMessage, fromLoadConversation) {
      if (latestMessage.includes(responseProtocol['recordNavigation'])) {
        return {latestMessage : prepareURLToNavigate(latestMessage,responseProtocol['recordNavigation'], fromLoadConversation, 'recordNavigation')};
      }
      else if(latestMessage.includes(responseProtocol['recordCreation'])){
        return { latestMessage: prepareURLToNavigate(latestMessage,responseProtocol['recordCreation'], fromLoadConversation, 'recordCreation')};
      }
      else if(latestMessage.includes(responseProtocol['playbookExecutionLog'])){
        return { latestMessage: prepareURLToNavigate(latestMessage,responseProtocol['playbookExecutionLog'], fromLoadConversation, 'playbookExecutionLog')};
      }
      else {
        return false;
      }
    }

    //to check which action has to be performed for navigation and is it called from load thread conversation 
    function prepareURLToNavigate(latestMessage, navigateAction, fromLoadConversation, protocol) { 
      let urlString = aiAssistantService.fetchURL(latestMessage);
      let navigateURL = urlString.split(navigateAction)[1];
      switch (protocol) {
        case 'recordNavigation':
          latestMessage  = aiAssistantService.getUpdatedURL(navigateURL, 'recordNavigation', latestMessage);
          let ifRecordOpen = aiAssistantService.checkIfRecordOpen(recordIRI,navigateURL);
          if (!fromLoadConversation && !ifRecordOpen) { //do not navigate while loading past conversations          
            $location.url(navigateURL);
          }
          break;
        case 'recordCreation':
          latestMessage  = aiAssistantService.getUpdatedURL(navigateURL, 'recordCreation', latestMessage);
          break;
        case 'playbookExecutionLog':
          latestMessage = aiAssistantService.getUpdatedURL(navigateURL, 'playbookExecutionLog', latestMessage);
          break;
        default:
          break;
      }
      return latestMessage;
    }

    function openDocumentation() {
      $window.open('https://github.com/fortinet-fortisoar/solution-pack-fortinet-advisor/blob/release/4.0.0/docs/usage.md#prompting-tips', '_blank');
    }

    function updateJsonOutline(value,index) {
      if (angular.isString(value)) {
        try {
          var activeConversation = $scope.getActiveConversation();
          if (activeConversation[index]) {
            activeConversation[index].text = value;
          }
        } catch (e) {
          // invalid JSON. skip the rest
          return;
        }
      }
      updateLocalStorageData();
      return;
    }

    function hideLoaders() {
      $scope.processingConversation = false;
      $scope.disableTextArea = false;
    }

    function textAreaActionsTriggered(){
      hideQuestionsPopUp(true);
    }

    //returns the active conversation array based on activeAssistant (exposed to template)
    $scope.getActiveConversation = function() {
      switch ($scope.activeAssistant) {
        case 'pb':
          return $scope.messages.pbAssistantConversation || [];
        case 'connector':
          return $scope.messages.connectorAssistantConversation || [];
        case 'soc':
          return $scope.messages.socAssitantConversation || [];
        case INSIGHT:
          return $scope.messages.insightConversation || [];
        default:
          return [];
      }
    };

    //returns the active conversation array key (for direct property access) based on activeAssistant
    $scope.getActiveConversationKey = function() {
      switch ($scope.activeAssistant) {
        case 'pb':
          return 'pbAssistantConversation';
        case 'connector':
          return 'connectorAssistantConversation';
        case 'soc':
          return 'socAssitantConversation';
        case INSIGHT:
          return 'insightConversation';
        default:
          return '';
      }
    };

    //update Conversation as per current page assistant
    function updateConversationMessages(_assistant, text_params) {
      var conversationArray;
      switch (_assistant) {
        case 'pb':
          conversationArray = $scope.messages.pbAssistantConversation;
          break;
        case 'connector':
          conversationArray = $scope.messages.connectorAssistantConversation;
          break;
        case 'soc':
          conversationArray = $scope.messages.socAssitantConversation;
          break;
        case INSIGHT:
          conversationArray = $scope.messages.insightConversation;
          break;
        default:
          return;
      }
      if (text_params && conversationArray) {
        conversationArray.push(text_params);
      }
      updateLocalStorageData();
    }

    //builds a message object with text, type and optional extra properties
    function buildMessage(text, type, extras) {
      var message = { text: text, type: type, timestamp: new Date() };
      if (extras) {
        angular.extend(message, extras);
      }
      return message;
    }

    //helper to build and push a message to the conversation in one call
    //reduces verbosity at call sites (e.g., pushMessage(getActiveParameters().assistant, 'Hello', 'user'))
    function pushMessage(assistant, text, type, extras) {
      updateConversationMessages(assistant, buildMessage(text, type, extras));
    }

    //remove the in-flight processing marker (the message pushed with
    //`processingConversation: true`) from the given assistant's conversation
    //once the agent run has completed. No-op if no such message exists.
    function removeProcessingMessage(assistant) {
      var conversationArray;
      switch (assistant) {
        case 'pb':
          conversationArray = $scope.messages.pbAssistantConversation;
          break;
        case 'connector':
          conversationArray = $scope.messages.connectorAssistantConversation;
          break;
        case 'soc':
          conversationArray = $scope.messages.socAssitantConversation;
          break;
        case INSIGHT:
          conversationArray = $scope.messages.insightConversation;
          break;
        default:
          return;
      }
      if (!conversationArray) {
        return;
      }
      var _index = conversationArray.findIndex(function (msg) {
        return msg.processingConversation;
      });
      if (_index !== -1) {
        conversationArray.splice(_index, 1);
        updateLocalStorageData();
      }
    }

    //***************** clear conversations ******************//

    //helper to reset assistant-specific thread ids and attachment data
    function clearAssistantState(assistant) {
      switch (assistant) {
        case 'connector':
          connectorThreadId = '';
          break;
        case 'pb':
          setPlaybookParameters();
          pbParameters.pbConversationThreadId = '';
          pbParameters.pbGenerationThreadId = '';
          break;
      }
    }

    function copyConversation(){
      var convKey = $scope.getActiveConversationKey();
      var messages = ($scope.messages[convKey] || []).map(function (message) {
        return {
          'message': message.text,
          'messageFrom': message.type
        };
      });
      CommonUtils.copy(messages);
    }

    function addAsComment(text) {
      var comment = {
        content: text,
        recordTags: ['FortiAI'],
        type: COMMENT_TYPES.COMMENT,
        people: []
      };
      var parentIri = $filter('prependIri')(currentModule + '/' + currentModuleId);
      comment[$scope.pageState.current.params.module] = [parentIri];
      comment.uuid = $window.UUID.generate();
      Modules.save({
        module: 'comments'
      }, angular.copy(comment)).$promise.then(function (response) {
        toaster.success({ body: 'Added as a comment to this record successfully!' });
      }).catch(function (error) {
        toaster.error({ body: "Unable to save comment" });
      });
    }


    function clearConversation() {
      //Determine the assistant whose bucket we are clearing before we mutate
      //$scope.activeAssistant below.
      var _assistantToClear = $scope.activeAssistant || getActiveParameters().assistant;
      clearPreviousIds(_assistantToClear);
      previous_pb_context = '';
      //Unlock the playbook-designer conversation area now that the user has
      //explicitly cleared the conversation.
      $scope.disableConversationInDesigner = false;
      clearSessionIds(_assistantToClear); //clear session ID
      resetToken();
      updateTokenTooltip($scope.tokenByAssistant);
      closeWebSocket();
      if (currentModule === INSIGHT) {
        clearConversationText($scope.activeAssistant);
        insightThreadId = '';
        updateThreadIdInLocalStoragae();
        messageHistory = null;
      }
      else {
        $scope.activeAssistant = getActiveParameters().assistant;
        clearConversationText($scope.activeAssistant);
        clearAssistantState($scope.activeAssistant);
        //reset conversation to initial bot message using helper key
        var convKey = $scope.getActiveConversationKey();
        if (convKey && initialBotMessage[convKey]) {
          $scope.messages[convKey] = angular.copy(initialBotMessage[convKey]);
          $scope.messages[convKey][0].timestamp = new Date();
        }
        updateConversationMessages(getActiveParameters().assistant);
        updateThreadIdInLocalStorage();
      }
    }

    //clear Conversation as per current page assistant
    function clearConversationText(_page) {
      var convKey = (function() {
        switch (_page) {
          case 'pb': return 'pbAssistantConversation';
          case 'connector': return 'connectorAssistantConversation';
          case 'soc': return 'socAssitantConversation';
          case INSIGHT: return 'insightConversation';
          default: return 'socAssitantConversation';
        }
      })();

      if (_page === INSIGHT && $scope.messages.insightConversation && $scope.messages.insightConversation.length > 0) {
        let initialExploreMessage = angular.copy($scope.messages.insightConversation[0].text);
        $scope.messages.insightConversation = [];
        pushMessage(INSIGHT, initialExploreMessage, MSG_TYPE_USER, {timestamp : new Date()});
      } else {
        $scope.messages[convKey] = [];
      }
    }

    function resetToken(){
      $scope.tokenByAssistant[$scope.activeAssistant] = getTokenObject();
      localStorageService.set('aiAssistantBot.tokens', $scope.tokenByAssistant);
    }

    function getTokenObject(){
      return {
          input_tokens : 0,
          llm_calls: 0,
          output_tokens: 0,
          total_tokens : 0
        };
    }

    //Request and response ids are tracked per assistant so each assistant's
    //conversation thread can carry its own response/request pair across calls.
    function getPreviousResponseId(assistant) {
      return (assistant && previousResponseByAssistant[assistant]) || '';
    }

    function getPreviousRequestId(assistant) {
      return (assistant && previousRequestByAssistant[assistant]) || '';
    }

    function setPreviousIds(assistant, response_id, request_id) {
      if (!assistant) {
        return;
      }
      if (!(assistant in previousResponseByAssistant)) {
        previousResponseByAssistant[assistant] = '';
        previousRequestByAssistant[assistant] = '';
      }
      previousResponseByAssistant[assistant] = response_id || '';
      previousRequestByAssistant[assistant] = request_id || '';
    }

    function clearPreviousIds(assistant) {
      if (!assistant) {
        return;
      }
      previousResponseByAssistant[assistant] = '';
      previousRequestByAssistant[assistant] = '';
    }

    function getSessionId(assistant) {
      return sessionIdByAssistant[assistant] || '';
    }

    function setSessionIds(assistant) {
      if (!assistant) {
        return;
      }
      if (!(assistant in sessionIdByAssistant)) {
        sessionIdByAssistant[assistant] = '';
      }
      sessionIdByAssistant[assistant] = sessionIdByAssistant[assistant] === '' ? CommonUtils.generateUUID() : sessionIdByAssistant[assistant];
      localStorageService.set('aiAssistantBot.sessionData', sessionIdByAssistant);
    }

    function clearSessionIds(assistant) {
      if (!assistant) {
        return;
      }
      sessionIdByAssistant[assistant] = '';
      localStorageService.set('aiAssistantBot.sessionData', sessionIdByAssistant);
    }

    /*********** Insights functions  ***********/
    //on explore button click 
    function exploreInsight(insight){
      let inputText = createInsightTemplate(insight);
        if($scope.messages.insightConversation && $scope.messages.insightConversation.length===0 ){
          pushMessage(getActiveParameters().assistant, inputText, MSG_TYPE_USER, { dataFor: INSIGHT });
          agentConversation();
          updateThreadIdInLocalStorage();
        }
    }

    //Insight template has a fixed structure 
    function createInsightTemplate(insight){
      let _insightTemplate = `<div class="font-size-16">Intent</div><div>${insight.data.query}</div>
        <label class="margin-top-lg font-size-16">Concise Summary</label><div> ${insight.data.result.concise_summary} </div> 
        <label class="margin-top-lg font-size-16">Summary</label><div> ${insight.data.result.summary} </div> 
        <label class="margin-top-lg font-size-16"> Suggested Actions</label>
            <ul>
                 ${insight.data.result.next_action
          .map(action => `<li>${action}</li>`)
          .join('')}
            </ul>`;
      return _insightTemplate;
    }

    /**
     * @ngdoc function
     * @name ai-assistant.controller#agentConversation
     * @param {Object} payload The payload containing the user question and previous response ID
     * @property {string} payload.question The user's question text
     * @property {string} payload.previous_response_id The ID of the previous response for context continuity
     * @description
     *
     * Initiates a conversation with the AI agent by sending the user's message.
     * Handles the response by checking the status:
     * - **'pending'**: Polls for execution status until completion
     * - **'completed'**: Directly fetches the final output
     * - **'failed'**: Rejects the promise with an error message
     *
     * Once the final response is received:
     * - Checks if the response contains navigation links (record navigation, creation, or playbook execution logs)
     * - Updates the conversation UI with the bot's response
     * - Stores the response_id for context in subsequent requests
     *
     * Always resets the processing state and scrolls to the bottom of the conversation on completion.
     *
     * @example
     * ```javascript
     * agentConversation({
     *   question: "Show me all alerts from the last 24 hours",
     *   previous_response_id: "resp_123"
     * });
     * ```
     *
     * @requires aiAgentsService.agentConversation
     * @requires aiAgentsService.pollAgentStatus
     * @requires aiAgentsService.conversationResult
     **/
    function agentConversation() {
      $scope.processingMessage = 'Processing...';
      const _assistantAtRequest = getActiveParameters().assistant;
      setSessionIds(_assistantAtRequest);
      let _payload = {
            "question": $scope.userInput.textVal,
            "previous_response_id": getPreviousResponseId(_assistantAtRequest),
            "request_id": getPreviousRequestId(_assistantAtRequest),
            "session_id": getSessionId(_assistantAtRequest)
          }
      const page_name = $scope.pageState.params?.module || $scope.pageState.current.name;
      _payload.userId = userLoginId;
      _payload.context = {
        pageName: page_name,
        userId: userUUID
      }
      if($scope.inRecordDetailedView){
        _payload.context.recordIRI = recordIRI;
        _payload.context.record = getEntityDetails();
      }
      if($scope.pbDesignerPage && previous_pb_context){
        _payload.context.playbook_context = previous_pb_context;
       disablePlaybookGeneration();
      }
      $scope.userInput.textVal = '';
      aiAgentsService.agentConversation($scope.agent.inUse, _payload, getSessionId(_assistantAtRequest))
        .then(function (response) {
          if (!response || !response.status || response.task_id === '') {
            return $q.reject('Invalid response');
          }
          if(response.task_id){
            //push a processing message and remove later
            pushMessage(getActiveParameters().assistant, '', MSG_TYPE_BOT, {
              taskId: response.task_id,
              processingConversation: true
            });
            initateWebSocket(response.task_id);
            scrollToBottom();
          }
          if (response.status === 'pending') {
            return pollExecutionStatus(response.task_id);
          }
          if (response.status === 'completed') {
            // task_id is on the agentConversation response, not on the
            // final /result response. Stash it on the returned object so
            // the downstream .then can use it for pushMessage.
            return pollFinalOutput(response.task_id).then(function (res) {
              res.task_id = response.task_id;
              return res;
            });
          }
          return $q.reject('Unexpected status: ' + response.status);
        })
        .then(function (taskId) {
          // pollExecutionStatus resolves with taskId
          return pollFinalOutput(taskId).then(function (res) {
            res.task_id = taskId;
            return res;
          });
        })
        .then(function (response) {
          //response_id add in payload for next request
          // task_id is attached to the final response above because the
          // /result endpoint doesn't echo it back.
          updateResponseMessages(response, _assistantAtRequest);
        })
        .catch(function (err) {
          pushMessage(getActiveParameters().assistant,  (err && err.data && err.data.message) ? err.data.message : botGeneralMessages.agentExecutionFailed, MSG_TYPE_BOT_GENERAL, {
                errorPresent : true
          });
        }).finally(function(){
          $scope.processingConversation = false;
          //Remove the in-flight processing marker from the assistant's
          //conversation list now that the agent run has completed.
          removeProcessingMessage(_assistantAtRequest);
          hideLoaders();
          $timeout(function () {
            scrollToBottom();
          });
        });
    }

    /**
     * @ngdoc function
     * @name ai-assistant.controller#updateResponseMessages
     * @param {Object} response The final agent response. The caller is
     *   responsible for validating that this object is non-null and has a
     *   `status` field; `task_id` is attached by the calling chain.
     * @description
     *
     * Renders the bot's reply and any side-effects once the agent run
     * completes. Behaviour by `response.status`:
     *
     * - **`'failed'`** — pushes a generic playbook-failed message and stops.
     * - **`'awaiting_approval'`** — flips `$scope.approvalRequired` on and
     *   copies the pending options onto `$scope.responseKeys`.
     * - **Otherwise** (completed / completed-with-followups):
     *   - If `response.answer` is present, pushes a bot message —
     *     preferring the navigation-stripped variant when the answer
     *     contains a record-navigation / creation / playbook-execution URL.
     *     In the playbook designer view, also stashes `playbook_context`
     *     for the next round-trip.
     *   - In the playbook designer, once `playbook_steps` are emitted,
     *     broadcasts them to the designer canvas and hides the bot modal.
     *   - Captures `response_id` / `request_id` so the next question in the
     *     thread can carry them as context.
     *
     * @requires pushMessage
     * @requires getActiveParameters
     * @requires checkIfNavigationPresent
     **/
    function updateResponseMessages(response, assistant) {
      //Default to the current page's assistant 
      const _assistant = assistant || getActiveParameters().assistant;

      if (response.status === 'awaiting_approval') {
        $scope.approvalRequired = true;
        $scope.responseKeys = response.pending && response.pending.options;
      }

      if (response.answer) {
        pushAnswerMessage(_assistant, response);
      }

      //-- paste PB steps in designer
      if ($scope.pbDesignerPage && response.playbook_steps && !response.is_user_input_needed) {
        previous_pb_context = '';
        pushMessage(_assistant, botGeneralMessages.pbStepGenerationCompleted, MSG_TYPE_BOT_GENERAL, {taskId : response.task_id,playbookGenerationComplete: true});
        $rootScope.$broadcast('designer:addPlaybookElements', response.playbook_steps);
        //Lock the conversation area — the steps are now in the canvas; further
        //chat is gated behind an explicit clearConversation.
        $scope.disableConversationInDesigner = true;
        hideLoaders();
        $timeout(hideBotModal, 1000);
      }

      //Write the response/request ids back to the assistant
      setPreviousIds(_assistant, response.response_id, response.request_id);
    }

    /**
     * Pushes the bot's answer message into the active conversation,
     * applying the right transform and metadata for the current page.
     *
     * - Non-playbook-designer pages: prefer the navigation-stripped answer
     *   (record navigation / creation / playbook-execution URLs are
     *   rendered as separate UI affordances and shouldn't pollute the
     *   conversational text).
     * - Playbook-designer pages: when the response carries a
     *   `playbook_context`, push the answer as JSON with playbook-
     *   generation flags, and persist the context for the follow-up call.
     *
     * No-op when `response.answer` is empty (caller already guards).
     */
    function pushAnswerMessage(assistant, response) {
      const taskId = response.task_id;

      if (!response.playbook_context) {
        const navigationPresent = checkIfNavigationPresent(response.answer);
        const text = navigationPresent ? navigationPresent.latestMessage : response.answer;
        pushMessage(assistant, text, MSG_TYPE_BOT, { taskId: taskId });
        return;
      }

      if (response.playbook_context) {
        let _message = response.answer;
        let _isJSONFormat = true;
        //----- this will be updated from backend later to keep standard format to show json type or plain text -----//
        if (response.playbook_context.content && Object.prototype.hasOwnProperty.call(response.playbook_context.content, 'failed')) {
            // failed key exists
            _isJSONFormat = false;
            _message = response.playbook_context.content.response || '';
        }
        if (response.is_user_input_needed) {
            // is_user_input_needed key exists
            _isJSONFormat = false;
        }
        pushMessage(assistant, _message, MSG_TYPE_BOT, {
          taskId: taskId,
          isJSONFormat: _isJSONFormat,
          generatePlaybook: _isJSONFormat
        });
        previous_pb_context = response.playbook_context;
      }
    }

    /**
     * Hides the bot's custom-modal wrapper. Guarded because the modal may
     * have been torn down already (e.g., the user closed it manually).
     */
    function hideBotModal() {
      const customModal = document.getElementById('custom-modal');
      if (customModal) {
        customModal.setAttribute('style', 'display:none;');
      }
    }

    /**
     * @ngdoc function
     * @name ai-assistant.controller#pollExecutionStatus
     * @param {string} taskId The unique identifier for the agent task being polled
     * @returns {Promise<string>} Resolves with the taskId when execution completes, rejects with error message on failure
     * @description
     *
     * Polls the agent execution status at regular intervals until completion or failure.
     * Uses service to create a promise that:
     * - **Resolves** with the `taskId` when `res.status === 'completed'`
     * - **Rejects** with 'Execution failed' when `res.status === 'failed'`
     * - **Rejects** with the error object if the API call fails
     *
     * The polling interval is defined by `INTERVAL_POLLING_TIME` (default: 5000ms).
     * The interval is cleared immediately upon completion or failure to prevent memory leaks.
     *
     * @requires aiAgentsService.pollAgentStatus
     **/
    function pollExecutionStatus(taskId) {
      return $q(function (resolve, reject) {
        const interval = setInterval(function () {
          aiAgentsService.pollAgentStatus(taskId)
            .then(function (res) {
              if (res.status === 'completed') {
                clearInterval(interval);
                resolve(taskId);
              }
              if (res.status === 'failed') {
                clearInterval(interval);
                reject('Execution failed');
              }
            })
            .catch(function (err) {
              clearInterval(interval);
              reject(err);
            });
        }, INTERVAL_POLLING_TIME);
      });
    }

    /**
     * @ngdoc function
     * @name ai-assistant.controller#pollFinalOutput
     * @param {string} taskId The unique identifier for the completed agent task
     * @returns {Promise<Object>} Resolves with the conversation result object, rejects if no result is available
     * @description
     *
     * Fetches the final output/response from a completed agent conversation task.
     * Called after {@link ai-assistant.controller#pollExecutionStatus `pollExecutionStatus`}
     * confirms that the task has completed.
     *
     * The response object contains:
     * - `answer`: The AI agent's response text
     * - `response_id`: A unique identifier for this response (used for context in subsequent requests)
     *
     * The function validates the response exists before resolving. If no result is found,
     * the promise is rejected with 'Failed to fetch output'.
     *
     * @requires aiAgentsService.conversationResult
     **/
    function pollFinalOutput(taskId) {
      return aiAgentsService.conversationResult(taskId)
        .then(function (res) {
          if (res) {
            getTokenConsumed();
            return res;
          }
          return $q.reject('Failed to fetch output');
        });
    }

    /**
     * @ngdoc function
     * @name ai-assistant.controller#getTokenConsumed
     * @returns {Promise<Object>} A promise that resolves with the updated
     *   `$scope.tokenUsage` object after the latest token consumption data
     *   is fetched. Rejects silently (logged only) if the request fails.
     * @description
     *
     * Refreshes the header's session token usage widget by calling
     * {@link fortisoar.aiAgentsService#tokenConsumption `aiAgentsService.tokenConsumption`}
     * and binding the result to `$scope.tokenUsage`. When usage is available,
     * rebuilds `$scope.tokenInformation` with a tooltip-friendly HTML snippet
     * summarizing total, input, and output tokens.
     *
     * Called from {@link ai-assistant.controller#pollFinalOutput `pollFinalOutput`}
     * after a successful agent task completion so the user sees up-to-date
     * consumption figures as the conversation progresses.
     *
     * @requires aiAgentsService.tokenConsumption
     **/
    function getTokenConsumed() {
      return aiAgentsService.tokenConsumption()
        .then(function (resp) {
          if (resp && resp.total_tokens) {
            $scope.tokenByAssistant[$scope.activeAssistant] = resp;
            //$scope.tokenUsage = resp;
            updateTokenTooltip($scope.tokenByAssistant[$scope.activeAssistant]);
          }
          localStorageService.set('aiAssistantBot.tokens', $scope.tokenByAssistant);
          return $scope.tokenByAssistant;
        })
        .catch(function (err) {
          // Token usage is non-critical; log and swallow so we don't break
          // the conversation flow.
          
          console.error('Failed to fetch token consumption:', err);
        });
    }

    function updateTokenTooltip(tokenUsage){
        $scope.tokenInformation = `Session Token Usage`;
        if (tokenUsage && tokenUsage.total_tokens) {
            $scope.tokenInformation =
              'Session Token Usage' +
              '<br> Total tokens: ' + tokenUsage.total_tokens +
              '</br> Input tokens: ' + tokenUsage.input_tokens +
              '</br> Output tokens: ' + tokenUsage.output_tokens;
          }
    }

    function getCurrentPageConfig() {
      const pageName = insightExploration ? INSIGHT : $scope.pageState.params?.module || $scope.pageState.current.name;
      return ACTIVE_PAGE_CONFIG[pageName] || ACTIVE_PAGE_CONFIG.default;
    }

    function getActiveParameters() {
      const config = getCurrentPageConfig();
      const params = {
        assistant: config.assistant,
        threadId: config.threadId()
      };
      if (config.conversationType) {
        params.conversationType = config.conversationType;
      }
      return params;
    }

    function setAgentInUse() {
      $scope.agent.inUse = getCurrentPageConfig().agent;
    }

    let modalTheme = '';
    switch ($scope.currentTheme) {
      case 'light':
      case 'dark': 
      case 'steel': 
        modalTheme = $scope.currentTheme + '-aiAgentTraceability-trace-flow';
          break;
      default:
        modalTheme = 'aiAgentTraceability-trace-flow';
    }

    //traceability 
    function loadTraceFlow(trace_id) {
      widgetService.getWidgetDef('aiAgentTraceability').then(function(response) {
        let _configTraceFlowModal = {
          animation: false,
          component: 'standaloneWidgetComponent',
          backdrop: 'static',
          windowClass: `fsr-standalone-modal modal-aiAgentTraceability-trace-flow ${ modalTheme }`,
          resolve: {
            definition: function() {
              return response;
            },
            config: function() {
              return {
                hideHeader: true,
                title: 'Trace Flow',
                trace_id: trace_id
              };
            }
          }
        };
        var modalInstance = $uibModal.open(_configTraceFlowModal);
        $rootScope.$broadcast('popupClosed', 'aiAssistant_6.0.0'); //will make it dynamic 
        const customModal = document.getElementById('custom-modal');
        customModal.setAttribute('style', 'display:none;');

        modalInstance.closed.then(function(){
          $rootScope.$broadcast('popupOpened', 'aiAssistant_6.0.0');
          const customModal = document.getElementById('custom-modal');
          customModal.setAttribute('style', 'display:block;');
        });
      }, function(error) {
        console.error(error);
      });
    }

    function copyMessageContent(_message){
       CommonUtils.copy(_message);
    }

    function getEntityDetails() {
      const entityData = FormEntityService.get().getData();
      if (!Array.isArray($scope.fieldsOfInterest) || $scope.fieldsOfInterest.length === 0) {
        return JSON.parse(JSON.stringify(entityData));
      }
      return $scope.fieldsOfInterest.reduce(function (filtered, key) {
        if (Object.prototype.hasOwnProperty.call(entityData, key)) {
          filtered[key] = entityData[key];
        }
        return JSON.parse(JSON.stringify(filtered));
      }, {});
    }

    //----Websocket functions ----// 

    function initateWebSocket(taskId){
      $scope.processingMessage = 'Processing...';
      websocketService.subscribe(`ai-agent/${taskId}`, function (response) {
        if (!response || !response.event) {
          stopProcessing();
          closeWebSocket();
          return;
        }
        updateSocketData(response);
        }).then(function (subsrciption) {
          webSocketSubscription = subsrciption;
        });
    }

    function updateSocketData(response){
      if(response.data && response.data.message){
        $scope.processingMessage = response.data.message+'...';
      }
    }

     function closeWebSocket() {
      if(webSocketSubscription){
        $scope.processingMessage = '';
        websocketService.unsubscribe();
      }
    }
  }
})();