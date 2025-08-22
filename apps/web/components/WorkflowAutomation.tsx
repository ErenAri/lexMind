'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { 
  Play,
  Pause,
  Square,
  Settings,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  X,
  Plus,
  Eye,
  Edit,
  Trash2,
  Zap,
  GitBranch,
  Calendar,
  User,
  FileText,
  Shield,
  BarChart3,
  Filter,
  ChevronDown,
  ChevronRight,
  Loader2
} from 'lucide-react';

interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  trigger_type: string;
  trigger_config: any;
  steps: any[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface WorkflowInstance {
  id: number;
  template_id: number;
  template_name: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  trigger_data: any;
  context_data: any;
  current_step: number;
  total_steps: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  assigned_to?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
}

interface WorkflowStatus {
  instance: any;
  steps: any[];
  progress: {
    current_step: number;
    total_steps: number;
    percentage: number;
  };
}

export default function WorkflowAutomation() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'instances' | 'monitor'>('instances');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const statusColors = {
    pending: 'bg-secondary-100 text-secondary-800',
    running: 'bg-blue-100 text-blue-800',
    completed: 'bg-success-100 text-success-800',
    failed: 'bg-danger-100 text-danger-800',
    cancelled: 'bg-warning-100 text-warning-800',
    paused: 'bg-orange-100 text-orange-800'
  };

  const statusIcons = {
    pending: Clock,
    running: Activity,
    completed: CheckCircle,
    failed: AlertTriangle,
    cancelled: X,
    paused: Pause
  };

  const priorityColors = {
    low: 'text-success-600',
    medium: 'text-warning-600',
    high: 'text-danger-600',
    critical: 'text-red-600'
  };

  const categoryIcons = {
    document_review: FileText,
    compliance_check: Shield,
    risk_assessment: AlertTriangle,
    audit_preparation: BarChart3,
    policy_update: Settings
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTemplates(),
        loadInstances()
      ]);
    } catch (error) {
      console.error('Failed to load workflow data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workflow/templates`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadInstances = async () => {
    try {
      const statusParam = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workflow/instances${statusParam}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setInstances(data.instances || []);
      }
    } catch (error) {
      console.error('Failed to load instances:', error);
    }
  };

  const loadWorkflowStatus = async (instanceId: number) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workflow/instances/${instanceId}/status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWorkflowStatus(data);
      }
    } catch (error) {
      console.error('Failed to load workflow status:', error);
    }
  };

  const createWorkflowInstance = async (templateId: number, triggerData: any = {}, contextData: any = {}) => {
    setActionLoading('create');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workflow/instances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          template_id: templateId,
          trigger_data: triggerData,
          context_data: contextData
        }),
      });

      if (response.ok) {
        const data = await response.json();
        await loadInstances();
        setShowCreateModal(false);
        return data;
      } else {
        throw new Error('Failed to create workflow instance');
      }
    } catch (error) {
      console.error('Failed to create workflow:', error);
      alert('Failed to create workflow instance');
    } finally {
      setActionLoading(null);
    }
  };

  const resumeWorkflow = async (instanceId: number) => {
    setActionLoading(`resume-${instanceId}`);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workflow/instances/${instanceId}/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        await loadInstances();
        if (selectedInstance?.id === instanceId) {
          await loadWorkflowStatus(instanceId);
        }
      } else {
        throw new Error('Failed to resume workflow');
      }
    } catch (error) {
      console.error('Failed to resume workflow:', error);
      alert('Failed to resume workflow');
    } finally {
      setActionLoading(null);
    }
  };

  const cancelWorkflow = async (instanceId: number) => {
    setActionLoading(`cancel-${instanceId}`);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workflow/instances/${instanceId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        await loadInstances();
        if (selectedInstance?.id === instanceId) {
          await loadWorkflowStatus(instanceId);
        }
      } else {
        throw new Error('Failed to cancel workflow');
      }
    } catch (error) {
      console.error('Failed to cancel workflow:', error);
      alert('Failed to cancel workflow');
    } finally {
      setActionLoading(null);
    }
  };

  const handleInstanceSelect = async (instance: WorkflowInstance) => {
    setSelectedInstance(instance);
    setActiveTab('monitor');
    await loadWorkflowStatus(instance.id);
  };

  const getStatusIcon = (status: string) => {
    const IconComponent = statusIcons[status as keyof typeof statusIcons] || Clock;
    return IconComponent;
  };

  const getCategoryIcon = (category: string) => {
    const IconComponent = categoryIcons[category as keyof typeof categoryIcons] || Settings;
    return IconComponent;
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStepProgress = (steps: any[]) => {
    if (!steps.length) return 0;
    const completedSteps = steps.filter(step => step.status === 'completed').length;
    return Math.round((completedSteps / steps.length) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900 flex items-center gap-3">
            <Zap className="h-8 w-8 text-primary-600" />
            Workflow Automation
          </h2>
          <p className="text-secondary-600">Automate compliance processes and document workflows</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-md"
          >
            <Plus className="h-4 w-4" />
            Create Workflow
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="btn btn-secondary btn-md"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-secondary-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('instances')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'instances' 
              ? 'bg-white text-secondary-900 shadow-sm' 
              : 'text-secondary-600 hover:text-secondary-900'
          }`}
        >
          <Activity className="h-4 w-4 inline mr-2" />
          Running Workflows
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'templates' 
              ? 'bg-white text-secondary-900 shadow-sm' 
              : 'text-secondary-600 hover:text-secondary-900'
          }`}
        >
          <Settings className="h-4 w-4 inline mr-2" />
          Templates
        </button>
        <button
          onClick={() => setActiveTab('monitor')}
          disabled={!selectedInstance}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'monitor' 
              ? 'bg-white text-secondary-900 shadow-sm' 
              : 'text-secondary-600 hover:text-secondary-900'
          } ${!selectedInstance ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Eye className="h-4 w-4 inline mr-2" />
          Monitor
        </button>
      </div>

      {/* Content */}
      {activeTab === 'instances' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="card p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-secondary-600" />
                <span className="text-sm font-medium text-secondary-700">Status:</span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input w-auto"
              >
                <option value="all">All Statuses</option>
                <option value="running">Running</option>
                <option value="pending">Pending</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Instances List */}
          <div className="grid grid-cols-1 gap-4">
            {instances.map((instance) => {
              const StatusIcon = getStatusIcon(instance.status);
              return (
                <div key={instance.id} className="card p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-secondary-900">{instance.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${statusColors[instance.status]}`}>
                          <StatusIcon className="inline h-3 w-3 mr-1" />
                          {instance.status.toUpperCase()}
                        </span>
                        <span className={`text-xs font-medium ${priorityColors[instance.priority]}`}>
                          {instance.priority.toUpperCase()} PRIORITY
                        </span>
                      </div>
                      <div className="text-sm text-secondary-600 space-y-1">
                        <p>Template: {instance.template_name}</p>
                        <p>Progress: {instance.current_step}/{instance.total_steps} steps</p>
                        {instance.assigned_to && <p>Assigned to: {instance.assigned_to}</p>}
                        {instance.started_at && <p>Started: {formatDateTime(instance.started_at)}</p>}
                        {instance.completed_at && <p>Completed: {formatDateTime(instance.completed_at)}</p>}
                        {instance.error_message && (
                          <p className="text-danger-600">Error: {instance.error_message}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleInstanceSelect(instance)}
                        className="btn btn-ghost btn-sm"
                      >
                        <Eye className="h-4 w-4" />
                        Monitor
                      </button>
                      
                      {instance.status === 'paused' && (
                        <button
                          onClick={() => resumeWorkflow(instance.id)}
                          disabled={actionLoading === `resume-${instance.id}`}
                          className="btn btn-primary btn-sm"
                        >
                          {actionLoading === `resume-${instance.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                          Resume
                        </button>
                      )}
                      
                      {['running', 'pending', 'paused'].includes(instance.status) && (
                        <button
                          onClick={() => cancelWorkflow(instance.id)}
                          disabled={actionLoading === `cancel-${instance.id}`}
                          className="btn btn-danger btn-sm"
                        >
                          {actionLoading === `cancel-${instance.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-secondary-200 rounded-full h-2">
                    <div 
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(instance.current_step / instance.total_steps) * 100}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            
            {instances.length === 0 && !loading && (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-secondary-900 mb-2">No workflow instances</h3>
                <p className="text-secondary-600">Create a new workflow to get started</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => {
            const CategoryIcon = getCategoryIcon(template.category);
            return (
              <div key={template.id} className="card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <CategoryIcon className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-secondary-900">{template.name}</h3>
                      <p className="text-sm text-secondary-600 capitalize">{template.category.replace('_', ' ')}</p>
                    </div>
                  </div>
                  
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    template.is_active ? 'bg-success-100 text-success-800' : 'bg-secondary-100 text-secondary-800'
                  }`}>
                    {template.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <p className="text-sm text-secondary-700 mb-4">{template.description}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary-600">Trigger:</span>
                    <span className="font-medium capitalize">{template.trigger_type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary-600">Steps:</span>
                    <span className="font-medium">{template.steps.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary-600">Created:</span>
                    <span className="font-medium">{new Date(template.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedTemplate(template)}
                    className="btn btn-ghost btn-sm flex-1"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <button
                    onClick={() => createWorkflowInstance(template.id)}
                    disabled={!template.is_active || actionLoading === 'create'}
                    className="btn btn-primary btn-sm flex-1"
                  >
                    {actionLoading === 'create' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Start
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'monitor' && selectedInstance && workflowStatus && (
        <div className="space-y-6">
          {/* Instance Overview */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-secondary-900 mb-2">{selectedInstance.name}</h3>
                <div className="flex items-center gap-4 text-sm text-secondary-600">
                  <span>Instance #{selectedInstance.id}</span>
                  <span>•</span>
                  <span className={`font-medium ${statusColors[selectedInstance.status]} px-2 py-1 rounded`}>
                    {selectedInstance.status.toUpperCase()}
                  </span>
                  <span>•</span>
                  <span>Progress: {workflowStatus.progress.percentage}%</span>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-bold text-primary-600 mb-1">
                  {workflowStatus.progress.current_step}/{workflowStatus.progress.total_steps}
                </div>
                <div className="text-sm text-secondary-600">Steps</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-secondary-200 rounded-full h-3 mb-4">
              <div 
                className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${workflowStatus.progress.percentage}%` }}
              ></div>
            </div>

            {/* Instance Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-secondary-600">Started:</span>
                <span className="ml-2 font-medium">{formatDateTime(selectedInstance.started_at)}</span>
              </div>
              <div>
                <span className="text-secondary-600">Assigned to:</span>
                <span className="ml-2 font-medium">{selectedInstance.assigned_to || 'Unassigned'}</span>
              </div>
              <div>
                <span className="text-secondary-600">Priority:</span>
                <span className={`ml-2 font-medium ${priorityColors[selectedInstance.priority]}`}>
                  {selectedInstance.priority.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-secondary-600">Template:</span>
                <span className="ml-2 font-medium">{selectedInstance.template_name}</span>
              </div>
            </div>
          </div>

          {/* Workflow Steps */}
          <div className="card p-6">
            <h4 className="text-lg font-semibold text-secondary-900 mb-4">Workflow Steps</h4>
            
            <div className="space-y-4">
              {workflowStatus.steps.map((step, index) => {
                const StepIcon = getStatusIcon(step.status);
                const isActive = step.step_number === workflowStatus.progress.current_step;
                
                return (
                  <div key={step.id} className={`p-4 border rounded-lg ${
                    isActive ? 'border-primary-500 bg-primary-50' : 'border-secondary-200'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${
                          step.status === 'completed' ? 'bg-success-100' :
                          step.status === 'running' ? 'bg-blue-100' :
                          step.status === 'failed' ? 'bg-danger-100' :
                          'bg-secondary-100'
                        }`}>
                          <StepIcon className={`h-4 w-4 ${
                            step.status === 'completed' ? 'text-success-600' :
                            step.status === 'running' ? 'text-blue-600' :
                            step.status === 'failed' ? 'text-danger-600' :
                            'text-secondary-600'
                          }`} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-medium text-secondary-900">{step.step_name}</h5>
                            <span className={`text-xs px-2 py-1 rounded-full ${statusColors[step.status]}`}>
                              {step.status.toUpperCase()}
                            </span>
                          </div>
                          
                          <p className="text-sm text-secondary-600 capitalize mb-2">
                            {step.step_type.replace('_', ' ')}
                          </p>
                          
                          {step.started_at && (
                            <div className="text-xs text-secondary-500 space-y-1">
                              <div>Started: {formatDateTime(step.started_at)}</div>
                              {step.completed_at && (
                                <div>Completed: {formatDateTime(step.completed_at)}</div>
                              )}
                              {step.duration_seconds && (
                                <div>Duration: {step.duration_seconds}s</div>
                              )}
                            </div>
                          )}
                          
                          {step.error_message && (
                            <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded text-sm text-danger-700">
                              {step.error_message}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-medium text-secondary-900">
                          Step {step.step_number}
                        </div>
                        {step.assigned_to && (
                          <div className="text-xs text-secondary-600">
                            {step.assigned_to}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Create Workflow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-secondary-900">Create Workflow</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-secondary-400 hover:text-secondary-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Select Template
                </label>
                <select
                  value={selectedTemplate?.id || ''}
                  onChange={(e) => {
                    const template = templates.find(t => t.id === parseInt(e.target.value));
                    setSelectedTemplate(template || null);
                  }}
                  className="input w-full"
                >
                  <option value="">Choose a template...</option>
                  {templates.filter(t => t.is_active).map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedTemplate && (
                <div className="p-3 bg-secondary-50 rounded-lg">
                  <p className="text-sm text-secondary-700">{selectedTemplate.description}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-secondary-600">
                    <span>Steps: {selectedTemplate.steps.length}</span>
                    <span>Category: {selectedTemplate.category.replace('_', ' ')}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedTemplate) {
                    createWorkflowInstance(selectedTemplate.id);
                  }
                }}
                disabled={!selectedTemplate || actionLoading === 'create'}
                className="btn btn-primary flex-1"
              >
                {actionLoading === 'create' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Create & Start'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}