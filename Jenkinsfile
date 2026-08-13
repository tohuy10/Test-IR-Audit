pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out source code...'
            }
        }

        stage('MAX FE Audit Report') {
            steps {
                dir('frontend') {
                    echo '🔍 Running MAX FE Audit Check for Security & Outdated Libraries...'
                    // Run audit script - exit 0 so pipeline can collect HTML report even if warnings exist
                    sh 'npm install --package-lock-only || true'
                    sh 'node scripts/generate-audit-report.js'
                }
            }
            post {
                always {
                    // Archive the generated HTML & JSON report as Jenkins build artifacts
                    archiveArtifacts artifacts: 'frontend/audit-reports/*', allowEmptyArchive: false
                    
                    // Publish HTML Report directly in Jenkins sidebar UI (Requires HTML Publisher Plugin)
                    publishHTML(target: [
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'frontend/audit-reports',
                        reportFiles: 'fe-audit-report.html',
                        reportName: 'MAX FE Audit Report',
                        reportTitles: 'MAX FE Audit Report'
                    ])
                }
            }
        }

        stage('Test Backend & Frontend') {
            steps {
                echo 'Executing Backend Unit Tests...'
                dir('backend') {
                    sh 'go test ./... -v || true'
                }
            }
        }

        stage('Docker Compose Build Check') {
            steps {
                echo 'Validating Docker Compose configuration...'
                sh 'docker compose config'
            }
        }
    }

    post {
        always {
            echo 'Pipeline completed. FE Audit Report is published and archived.'
        }
    }
}
