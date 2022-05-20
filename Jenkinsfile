@Library('jenkins-library')

Map    targetEnvMap          = ['dev': 'DEV', 'test': 'TST', 'stage1': 'STG']
String targetEnvironment     = findGroups(env.JOB_NAME, targetEnvMap.keySet().join('|')) ? getEnvFromJobName() : 'dev'
List   jobParams             = [ string(defaultValue: targetEnvironment, name: 'targetEnvironment', trim: true) ]
String jobList               = '../deploy/sora2-' + targetEnvironment
String agentLabel            = 'docker-build-agent'
String agentImage            = 'node:14-ubuntu'
String registryUrl           = 'https://docker.soramitsu.co.jp'
String registryCredentialsId = 'bot-build-tools-ro'

properties([
    parameters( jobParams ),
    pipelineTriggers([upstream( jobList )])
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
        stage('repair accounts and liquidity pairs') {
            environment {
                ACCOUNT_PHRASE  = "${params.ACCOUNT_PHRASE}"
                BALANCES        = "${params.BALANCES}"
                ENV             = "${params.ENV}"
                ENV_NODE        = "${params.ENV_NODE}"
            }
            steps {
                script {
                    docker.withRegistry( registryUrl, registryCredentialsId ){
                        docker.image( "docker.soramitsu.co.jp/build-tools/" + agentImage ).inside(){
                            sh '''
                                yarn prepareTestAccount
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