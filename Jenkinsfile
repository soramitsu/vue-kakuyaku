@Library('jenkins-library')

Map    targetEnvMap          = ['dev': 'DEV', 'test': 'TST', 'stage1': 'STG']
String targetEnvironment     = findGroups(env.JOB_NAME, targetEnvMap.keySet().join('|')) ? getEnvFromJobName() : 'dev'
List   jobParams             = [ string(defaultValue: targetEnvironment, name: 'targetEnvironment', trim: true) ]
// String jobList               = '../deploy/sora2-' + targetEnvironment - no upstream jobs needed
String agentLabel            = 'docker-build-agent'
String agentImage            = 'node:14-ubuntu'
String registryUrl           = 'https://docker.soramitsu.co.jp'
String registryCredentialsId = 'bot-build-tools-ro'

properties([
    parameters( jobParams )//,
//    pipelineTriggers([upstream( jobList )]) - no upstream jobs needed
])

pipeline {
    options {
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timestamps()
        disableConcurrentBuilds()
    }
    agent {
        label agentLabel
    }
    stages {
        stage('stage1 - to be determined') {
            environment {
                // PARAM_1  = "${params.PARAM_1}"
                // PARAM_2  = "${params.PARAM_2}"
            }
            steps {
                script {
                    docker.withRegistry( registryUrl, registryCredentialsId ){
                        docker.image( "docker.soramitsu.co.jp/build-tools/" + agentImage ).inside(){
                            sh '''
                                npm install -g typescript
                                yarn install
                                yarn test
                            '''
                        }
                    }
                }
            }
        }
        stage('stage2 - to be determined') {
            environment {
                // PARAM_1  = "${params.PARAM_1}"
                // PARAM_2  = "${params.PARAM_2}"
            }
            steps {
                script {
                    docker.withRegistry( registryUrl, registryCredentialsId ){
                        docker.image( "docker.soramitsu.co.jp/build-tools/" + agentImage ).inside(){
                            sh '''
                                npm install -g typescript
                                yarn install
                                yarn test
                            '''
                        }
                    }
                }
            }
        }
    }
    post {
        cleanup {
            script {
                cleanWs()
            }
        }
    }
}