/* Copyright (C) 2008 - 2026 Fortinet Inc.
All rights reserved.
FORTINET CONFIDENTIAL & FORTINET PROPRIETARY SOURCE CODE */

'use strict';
(function () {
    angular
        .module('cybersponse')
        .controller('editAiAssistant600Ctrl', editAiAssistant600Ctrl);

    editAiAssistant600Ctrl.$inject = ['$scope', '$uibModalInstance', 'config'];

    function editAiAssistant600Ctrl($scope, $uibModalInstance, config) {
        $scope.cancel = cancel;
        $scope.save = save;
        $scope.config = config;

        function cancel() {
            $uibModalInstance.dismiss('cancel');
        }

        function save() {
            $uibModalInstance.close($scope.config);
        }

    }
})();
