pipeline {
    agent none // Definiamo l'agente a livello di stage
    
    environment {
        // Repository GitHub
        GITHUB_REPOSITORY = 'WebRobot-Ltd/portal'
        
        // Immagine Docker su GHCR (deve essere lowercase)
        DOCKER_IMAGE = "ghcr.io/webrobot-ltd/portal"
        DOCKER_TAG = "${env.BUILD_NUMBER}"
        
        // Credenziali
        DOCKER_REGISTRY = 'ghcr.io'
        DOCKER_CREDENTIALS = 'github-token'
        
        // Kubernetes
        K8S_NAMESPACE = 'webrobot'
        K8S_CONTEXT = 'webrobot'
    }
    
    parameters {
        choice(
            name: 'BUILD_TYPE',
            choices: ['dev', 'staging', 'production'],
            description: 'Tipo di build da eseguire'
        )
        booleanParam(
            name: 'REDEPLOY_ONLY',
            defaultValue: false,
            description: 'Salta build e test, esegui solo il deploy K8s'
        )
        booleanParam(
            name: 'PUSH_IMAGE',
            defaultValue: true,
            description: 'Push dell\'immagine Docker su GHCR'
        )
        booleanParam(
            name: 'DEPLOY_K8S',
            defaultValue: true,
            description: 'Deploy automatico su Kubernetes'
        )
    }
    
    stages {
        stage('Initialize') {
            steps {
                script {
                    env.DO_DEPLOY = false
                    def cause = currentBuild.getBuildCauses('hudson.triggers.SCMTrigger$SCMTriggerCause')
                    if (cause) {
                        echo "Build triggerato da SCM. Abilito il deploy automatico."
                        env.DO_DEPLOY = true
                    }
                }
            }
        }
        
        stage('Checkout') {
            agent any
            steps {
                checkout scm
                script {
                    echo "🔄 Checkout completato per build ${env.BUILD_TYPE}"
                    echo "📦 Repository: ${env.GITHUB_REPOSITORY}"
                    echo "🐳 Immagine: ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}"
                    echo "🏗️ Build Type: ${params.BUILD_TYPE}"
                }
            }
        }
        
        stage('Build Site') {
            when {
                expression { !params.REDEPLOY_ONLY }
            }
            agent {
                kubernetes {
                    label 'nodejs'
                    // node:20-bookworm-slim (glibc) instead of -alpine
                    // (musl). esbuild/sharp/etc. ship glibc-first; the
                    // alpine variant occasionally fails the postinstall
                    // silently and leaves the build hanging instead of
                    // crashing.
                    //
                    // Resources are explicit: vitepress build on this
                    // site peaks around 1.3 GB heap (Vue components +
                    // every markdown page). Without limits the pod
                    // inherits k8s defaults and the OOM-killer reaps
                    // the node process while the sidecar 'sleep 99d'
                    // stays alive — Jenkins then thinks the sh step
                    // is still running and hangs the whole pipeline.
                    yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: nodejs
    image: node:20-bookworm-slim
    command:
    - sleep
    args:
    - 99d
    env:
    - name: NODE_OPTIONS
      value: "--max-old-space-size=3072"
    resources:
      requests:
        cpu: "500m"
        memory: "2Gi"
      limits:
        cpu: "2000m"
        memory: "3Gi"
"""
                }
            }
            steps {
                container('nodejs') {
                    script {
                        // Bound the whole stage so a wedged build fails
                        // the pipeline in 15 min instead of holding the
                        // Jenkins worker indefinitely.
                        timeout(time: 15, unit: 'MINUTES') {
                            echo "📦 Installazione dipendenze..."
                            sh 'npm ci'

                            echo "🔨 Build sito VitePress..."
                            sh 'npm run build'

                            echo "✅ Verifica file generati..."
                            sh 'test -d .vitepress/dist || (echo "❌ Directory .vitepress/dist non trovata!" && exit 1)'
                            sh 'ls -lh .vitepress/dist/ | head -20'
                            sh 'du -sh .vitepress/dist/'
                        }
                    }
                }
            }
        }

        stage('Build & Push Docker Image') {
            when {
                expression { !params.REDEPLOY_ONLY && params.PUSH_IMAGE }
            }
            agent {
                kubernetes {
                    label 'docker'
                    yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: docker
    image: docker:20.10.17
    command:
    - sleep
    args:
    - 99d
  - name: kaniko
    image: gcr.io/kaniko-project/executor:v1.9.0-debug
    imagePullPolicy: Always
    command:
    - /busybox/cat
    tty: true
    volumeMounts:
      - name: jenkins-docker-cfg
        mountPath: /kaniko/.docker
  volumes:
    - name: jenkins-docker-cfg
      projected:
        sources:
        - secret:
            name: docker-config-secret
            items:
              - key: .dockerconfigjson
                path: config.json
"""
                }
            }
            steps {
                container('kaniko') {
                    script {
                        echo "🐳 Build e Push immagine Docker con Kaniko..."
                        sh """
                            /kaniko/executor --context=\$(pwd) \\
                                --dockerfile=Dockerfile \\
                                --destination=${env.DOCKER_IMAGE}:${env.DOCKER_TAG} \\
                                --destination=${env.DOCKER_IMAGE}:latest \\
                                --cache=false
                        """
                    }
                }
            }
        }

        stage('Deploy to Kubernetes') {
            when {
                expression { params.DEPLOY_K8S || params.REDEPLOY_ONLY || env.DO_DEPLOY == 'true' }
            }
            agent {
                kubernetes {
                    label 'kubectl'
                    yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: kubectl
    image: alpine/k8s:1.28.2
    command:
    - sleep
    args:
    - 99d
"""
                }
            }
            steps {
                container('kubectl') {
                    script {
                        echo "⚙️ Deploy su Kubernetes..."
                        
                        // Crea/aggiorna deployment, service e ingress se necessario
                        def imageTag = params.REDEPLOY_ONLY ? 'latest' : env.DOCKER_TAG
                        echo "Deploying image with tag: ${imageTag}"
                        
                        // Applica manifesti Kubernetes (se esistono nella directory k8s/)
                        sh """
                            if [ -d k8s ]; then
                                echo "📋 Applicazione manifesti Kubernetes..."
                                # Applica tutti i manifesti nel namespace webrobot
                                kubectl apply -f k8s/deployment.yaml -n webrobot || true
                                kubectl apply -f k8s/service.yaml -n webrobot || true
                                kubectl apply -f k8s/ingress.yaml -n webrobot || true
                                
                                # Aggiorna l'immagine se necessario
                                kubectl set image deployment/webrobot-portal \\
                                    portal=${env.DOCKER_IMAGE}:${imageTag} \\
                                    -n webrobot || true
                            else
                                echo "⚠️ Directory k8s/ non trovata, creazione deployment base..."
                                kubectl create deployment webrobot-portal \\
                                    --image=${env.DOCKER_IMAGE}:${imageTag} \\
                                    --namespace=webrobot \\
                                    --dry-run=client -o yaml | kubectl apply -f - || true
                                
                                kubectl set image deployment/webrobot-portal \\
                                    portal=${env.DOCKER_IMAGE}:${imageTag} \\
                                    -n webrobot || true
                            fi
                        """
                        
                        // Attendi il rollout del deployment
                        sh "kubectl rollout status deployment/webrobot-portal -n webrobot --timeout=5m || echo '⚠️ Deployment non trovato o rollout in corso'"
                        
                        echo "✅ Deploy su Kubernetes completato"
                    }
                }
            }
        }
    }
    
    post {
        success {
            script {
                echo "✅ Pipeline completata con successo!"
                echo "🐳 Immagine: ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}"
                echo "🏗️ Build Type: ${params.BUILD_TYPE}"
                echo "🚀 Push: ${params.PUSH_IMAGE ? 'Completato' : 'Saltato'}"
                echo "⚙️ Deploy: ${params.DEPLOY_K8S ? 'Completato' : 'Saltato'}"
            }
        }
        failure {
            script {
                echo "❌ Pipeline fallita!"
                echo "🔍 Controlla i log per i dettagli"
            }
        }
        always {
            script {
                echo "🏁 Build ${env.BUILD_NUMBER} completata"
                echo "📊 Durata totale: ${currentBuild.durationString}"
            }
        }
    }
}

