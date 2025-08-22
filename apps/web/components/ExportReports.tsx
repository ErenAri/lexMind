'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { 
  Download,
  FileText,
  BarChart3,
  Shield,
  Calendar,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  Target,
  Settings
} from 'lucide-react';

interface ExportOptions {
  format: 'pdf' | 'csv' | 'json';
  reportType: 'compliance_summary' | 'detailed_analysis' | 'risk_assessment' | 'framework_coverage';
  dateRange: 'week' | 'month' | 'quarter' | 'year' | 'all';
  includeDetails: boolean;
  includeCharts: boolean;
  includeRecommendations: boolean;
}

export default function ExportReports() {
  const { user } = useAuth();
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'pdf',
    reportType: 'compliance_summary',
    dateRange: 'month',
    includeDetails: true,
    includeCharts: true,
    includeRecommendations: true
  });
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const reportTypes = [
    {
      id: 'compliance_summary',
      name: 'Compliance Summary',
      description: 'Overview of compliance status across all documents',
      icon: Shield,
      estimatedSize: '2-5 MB'
    },
    {
      id: 'detailed_analysis',
      name: 'Detailed Analysis',
      description: 'Comprehensive analysis with all findings and evidence',
      icon: FileText,
      estimatedSize: '5-15 MB'
    },
    {
      id: 'risk_assessment',
      name: 'Risk Assessment',
      description: 'Focus on high-risk items and critical compliance gaps',
      icon: AlertTriangle,
      estimatedSize: '1-3 MB'
    },
    {
      id: 'framework_coverage',
      name: 'Framework Coverage',
      description: 'Coverage analysis for each compliance framework',
      icon: Target,
      estimatedSize: '2-4 MB'
    }
  ];

  const generateReport = async () => {
    setExporting(true);
    
    try {
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Generate mock report content
      const reportContent = generateMockReport();
      
      // Create and download file
      const blob = new Blob([reportContent], { 
        type: exportOptions.format === 'pdf' ? 'application/pdf' : 
              exportOptions.format === 'csv' ? 'text/csv' : 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lexmind-${exportOptions.reportType}-${new Date().toISOString().split('T')[0]}.${exportOptions.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setLastExport(new Date().toISOString());
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const generateMockReport = (): string => {
    const timestamp = new Date().toISOString();
    
    if (exportOptions.format === 'json') {
      return JSON.stringify({
        report_type: exportOptions.reportType,
        generated_at: timestamp,
        generated_by: user?.username,
        date_range: exportOptions.dateRange,
        summary: {
          total_documents: 125,
          analyzed_documents: 98,
          average_compliance_score: 78.5,
          high_risk_documents: 12,
          compliant_documents: 67,
          partially_compliant: 23,
          non_compliant: 8
        },
        frameworks: [
          { name: 'GDPR', coverage: 85, compliant_items: 15, total_items: 18 },
          { name: 'SOX', coverage: 92, compliant_items: 11, total_items: 12 },
          { name: 'HIPAA', coverage: 76, compliant_items: 19, total_items: 25 },
          { name: 'ISO27001', coverage: 68, compliant_items: 27, total_items: 40 }
        ],
        top_risks: [
          'Missing data encryption policies',
          'Inadequate access controls documentation',
          'Incomplete incident response procedures',
          'Outdated privacy policy requirements'
        ],
        recommendations: [
          'Update data encryption standards',
          'Implement comprehensive access control matrix',
          'Develop detailed incident response playbook',
          'Review and update privacy policies'
        ]
      }, null, 2);
    }
    
    if (exportOptions.format === 'csv') {
      return [
        'Document,Compliance Score,Risk Level,Framework,Last Analyzed,Issues',
        'privacy-policy.pdf,85,Medium,GDPR,2024-01-15,2',
        'financial-controls.pdf,92,Low,SOX,2024-01-14,1',
        'security-procedures.pdf,67,High,ISO27001,2024-01-13,5',
        'data-handling.pdf,78,Medium,HIPAA,2024-01-12,3',
        'employee-handbook.pdf,89,Low,General,2024-01-11,1'
      ].join('\\n');
    }
    
    // PDF-style content (simplified)
    return `
LEXMIND COMPLIANCE REPORT
${exportOptions.reportType.replace('_', ' ').toUpperCase()}

Generated: ${new Date().toLocaleDateString()}
Generated by: ${user?.username}
Date Range: ${exportOptions.dateRange}

EXECUTIVE SUMMARY
================
Total Documents: 125
Analyzed Documents: 98
Average Compliance Score: 78.5%
High Risk Documents: 12

COMPLIANCE STATUS BREAKDOWN
===========================
✓ Compliant: 67 documents (68%)
⚠ Partially Compliant: 23 documents (23%)
✗ Non-Compliant: 8 documents (8%)

FRAMEWORK COVERAGE
==================
GDPR: 85% coverage (15/18 requirements)
SOX: 92% coverage (11/12 requirements)
HIPAA: 76% coverage (19/25 requirements)
ISO27001: 68% coverage (27/40 requirements)

TOP RISKS IDENTIFIED
====================
1. Missing data encryption policies
2. Inadequate access controls documentation
3. Incomplete incident response procedures
4. Outdated privacy policy requirements

RECOMMENDATIONS
===============
1. Update data encryption standards
2. Implement comprehensive access control matrix
3. Develop detailed incident response playbook
4. Review and update privacy policies

This report was generated by LexMind Compliance AI Assistant.
For questions, contact: ${user?.email || 'support@lexmind.com'}
    `.trim();
  };

  const getReportIcon = (reportType: string) => {
    const report = reportTypes.find(r => r.id === reportType);
    return report?.icon || FileText;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900 flex items-center gap-3">
            <Download className="h-8 w-8 text-primary-600" />
            Export Reports
          </h2>
          <p className="text-secondary-600">Generate compliance reports and export your data</p>
        </div>
        
        {lastExport && (
          <div className="text-sm text-secondary-600">
            Last export: {new Date(lastExport).toLocaleString()}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export Configuration */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Report Type Selection */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4">Select Report Type</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reportTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <label
                    key={type.id}
                    className={`cursor-pointer p-4 border-2 rounded-lg transition-colors ${
                      exportOptions.reportType === type.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-secondary-200 hover:border-secondary-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportType"
                      value={type.id}
                      checked={exportOptions.reportType === type.id}
                      onChange={(e) => setExportOptions(prev => ({ ...prev, reportType: e.target.value as any }))}
                      className="sr-only"
                    />
                    <div className="flex items-start gap-3">
                      <Icon className={`h-6 w-6 mt-1 ${
                        exportOptions.reportType === type.id ? 'text-primary-600' : 'text-secondary-600'
                      }`} />
                      <div>
                        <h4 className="font-medium text-secondary-900">{type.name}</h4>
                        <p className="text-sm text-secondary-600 mt-1">{type.description}</p>
                        <p className="text-xs text-secondary-500 mt-2">Est. size: {type.estimatedSize}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Export Options */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4">Export Options</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Format */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Export Format
                </label>
                <select
                  value={exportOptions.format}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as any }))}
                  className="input w-full"
                >
                  <option value="pdf">PDF Report</option>
                  <option value="csv">CSV Data</option>
                  <option value="json">JSON Data</option>
                </select>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Date Range
                </label>
                <select
                  value={exportOptions.dateRange}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, dateRange: e.target.value as any }))}
                  className="input w-full"
                >
                  <option value="week">Past Week</option>
                  <option value="month">Past Month</option>
                  <option value="quarter">Past Quarter</option>
                  <option value="year">Past Year</option>
                  <option value="all">All Time</option>
                </select>
              </div>
            </div>

            {/* Include Options */}
            <div className="mt-6">
              <h4 className="font-medium text-secondary-900 mb-3">Include in Report</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeDetails}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeDetails: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-secondary-700">Detailed findings and evidence</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeCharts}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeCharts: e.target.checked }))}
                    className="rounded"
                    disabled={exportOptions.format === 'csv'}
                  />
                  <span className={`text-sm ${exportOptions.format === 'csv' ? 'text-secondary-400' : 'text-secondary-700'}`}>
                    Charts and visualizations
                  </span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeRecommendations}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeRecommendations: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-secondary-700">AI recommendations and action items</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Preview and Actions */}
        <div className="space-y-6">
          
          {/* Report Preview */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4">Report Preview</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg">
                {(() => {
                  const Icon = getReportIcon(exportOptions.reportType);
                  return <Icon className="h-8 w-8 text-primary-600" />;
                })()}
                <div>
                  <h4 className="font-medium text-secondary-900">
                    {reportTypes.find(t => t.id === exportOptions.reportType)?.name}
                  </h4>
                  <p className="text-sm text-secondary-600">
                    {exportOptions.format.toUpperCase()} • {exportOptions.dateRange}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary-600">Format:</span>
                  <span className="font-medium text-secondary-900">{exportOptions.format.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-600">Period:</span>
                  <span className="font-medium text-secondary-900 capitalize">{exportOptions.dateRange}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-600">Details:</span>
                  <span className="font-medium text-secondary-900">
                    {exportOptions.includeDetails ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-600">Charts:</span>
                  <span className="font-medium text-secondary-900">
                    {exportOptions.includeCharts && exportOptions.format !== 'csv' ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Export Action */}
          <div className="card p-6">
            <button
              onClick={generateReport}
              disabled={exporting}
              className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Generate & Download
                </>
              )}
            </button>

            {exporting && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-secondary-600 mb-2">
                  <span>Processing...</span>
                  <span>Please wait</span>
                </div>
                <div className="w-full bg-secondary-200 rounded-full h-2">
                  <div className="bg-primary-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="card p-6">
            <h3 className="font-semibold text-secondary-900 mb-4">Quick Stats</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-secondary-600" />
                  <span className="text-sm text-secondary-700">Total Documents</span>
                </div>
                <span className="font-medium text-secondary-900">125</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success-600" />
                  <span className="text-sm text-secondary-700">Compliant</span>
                </div>
                <span className="font-medium text-success-600">67</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning-600" />
                  <span className="text-sm text-secondary-700">Partially Compliant</span>
                </div>
                <span className="font-medium text-warning-600">23</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-danger-600" />
                  <span className="text-sm text-secondary-700">Non-Compliant</span>
                </div>
                <span className="font-medium text-danger-600">8</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}