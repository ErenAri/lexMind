'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { api } from '@/lib/api';
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  TrendingUp, 
  Users, 
  Sparkles, 
  FileText, 
  Clock, 
  Target,
  Settings,
  BarChart3,
  Eye,
  Download,
  BookOpen,
  Filter,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface Recommendation {
  recommendation_id: string;
  document_id: number;
  title: string;
  path: string;
  recommendation_type: string;
  score: number;
  reasoning: string;
  source_document_id?: number;
  metadata: Record<string, any>;
}

interface RecommendationsResponse {
  recommendations: Recommendation[];
  total: number;
  user_profile_summary: {
    interaction_count: number;
    preferred_topics: string[];
    compliance_frameworks: string[];
    engagement_level: number;
  };
}

interface UserPreferences {
  user_id: string;
  preferred_recommendation_types: string[];
  excluded_topics: string[];
  preferred_compliance_frameworks: string[];
  recommendation_frequency: string;
  max_recommendations_per_session: number;
  enable_ai_explanations: boolean;
  enable_trend_based: boolean;
  enable_collaborative_filtering: boolean;
}

interface RecommendationAnalytics {
  date_range: {
    start: string;
    end: string;
    days: number;
  };
  total_recommendations: number;
  click_through_rate: number;
  average_rating: number;
  top_recommendation_types: Array<{
    type: string;
    count: number;
    clicks: number;
    click_through_rate: number;
  }>;
  user_engagement_metrics: {
    active_users: number;
    avg_interactions_per_user: number;
    avg_engagement_level: number;
  };
}

const RECOMMENDATION_TYPE_LABELS = {
  similar_content: { label: 'Similar Content', icon: FileText, color: 'bg-blue-500' },
  compliance_related: { label: 'Compliance Related', icon: Target, color: 'bg-green-500' },
  trending: { label: 'Trending', icon: TrendingUp, color: 'bg-orange-500' },
  personalized: { label: 'Personalized', icon: Users, color: 'bg-purple-500' },
  workflow_suggested: { label: 'Workflow Suggested', icon: Clock, color: 'bg-indigo-500' },
  ai_curated: { label: 'AI Curated', icon: Sparkles, color: 'bg-pink-500' }
};

export default function SmartRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [profileSummary, setProfileSummary] = useState<any>({});
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [analytics, setAnalytics] = useState<RecommendationAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('recommendations');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [contextDocumentId, setContextDocumentId] = useState<string>('');
  const [feedbackModal, setFeedbackModal] = useState<{ recommendation: Recommendation | null; isOpen: boolean }>({
    recommendation: null,
    isOpen: false
  });
  const [rating, setRating] = useState(0);
  const [feedbackNotes, setFeedbackNotes] = useState('');

  const loadRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        limit: '15',
        ...(selectedTypes.length > 0 && { types: selectedTypes.join(',') }),
        ...(contextDocumentId && { context_document_id: contextDocumentId })
      });
      
      const response = await api.get<RecommendationsResponse>(`/recommendations?${params}`);
      
      setRecommendations(response.recommendations || []);
      setProfileSummary(response.user_profile_summary || {});
      
    } catch (error) {
      console.error('Failed to load recommendations:', error);
      toast.error('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, [selectedTypes, contextDocumentId]);

  const loadPreferences = useCallback(async () => {
    try {
      const response = await api.get<UserPreferences>('/recommendations/preferences');
      setPreferences(response);
    } catch (error) {
      console.error('Failed to load preferences:', error);
      toast.error('Failed to load preferences');
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const response = await api.get<RecommendationAnalytics>('/recommendations/analytics?days=30');
      setAnalytics(response);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('Failed to load analytics');
    }
  }, []);

  useEffect(() => {
    loadRecommendations();
    loadPreferences();
    if (activeTab === 'analytics') {
      loadAnalytics();
    }
  }, [loadRecommendations, loadPreferences, activeTab, loadAnalytics]);

  const handleDocumentClick = async (recommendation: Recommendation) => {
    try {
      // Track interaction
      await api.post('/recommendations/interaction', {
        document_id: recommendation.document_id,
        interaction_type: 'view',
        depth: 'browse',
        referrer_source: 'recommendations',
        metadata: {
          recommendation_id: recommendation.recommendation_id,
          recommendation_type: recommendation.recommendation_type
        }
      });

      // Navigate to document (you can customize this based on your routing)
      window.open(`/documents/${encodeURIComponent(recommendation.path)}`, '_blank');
      
    } catch (error) {
      console.error('Failed to track interaction:', error);
    }
  };

  const handleFeedback = async () => {
    if (!feedbackModal.recommendation || rating === 0) return;
    
    try {
      await api.post('/recommendations/feedback', {
        recommendation_id: feedbackModal.recommendation.recommendation_id,
        rating,
        notes: feedbackNotes
      });
      
      toast.success('Feedback submitted successfully!');
      setFeedbackModal({ recommendation: null, isOpen: false });
      setRating(0);
      setFeedbackNotes('');
      
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to submit feedback');
    }
  };

  const updatePreferences = async (updatedPrefs: Partial<UserPreferences>) => {
    if (!preferences) return;
    
    try {
      const newPrefs = { ...preferences, ...updatedPrefs };
      await api.put('/recommendations/preferences', newPrefs);
      setPreferences(newPrefs);
      toast.success('Preferences updated successfully!');
      
      // Reload recommendations with new preferences
      await loadRecommendations();
      
    } catch (error) {
      console.error('Failed to update preferences:', error);
      toast.error('Failed to update preferences');
    }
  };

  const getRecommendationTypeInfo = (type: string) => {
    return RECOMMENDATION_TYPE_LABELS[type as keyof typeof RECOMMENDATION_TYPE_LABELS] || 
           { label: type, icon: FileText, color: 'bg-gray-500' };
  };

  const StarRating = ({ value, onChange, readonly = false }: { value: number; onChange?: (rating: number) => void; readonly?: boolean }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-5 h-5 cursor-pointer transition-colors ${
            star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
          }`}
          onClick={() => !readonly && onChange?.(star)}
        />
      ))}
    </div>
  );

  const RecommendationCard = ({ recommendation }: { recommendation: Recommendation }) => {
    const typeInfo = getRecommendationTypeInfo(recommendation.recommendation_type);
    const IconComponent = typeInfo.icon;

    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => handleDocumentClick(recommendation)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${typeInfo.color} bg-opacity-10`}>
                <IconComponent className={`w-4 h-4 ${typeInfo.color.replace('bg-', 'text-')}`} />
              </div>
              <div className="flex-1">
                <CardTitle className="text-sm font-medium line-clamp-2 group-hover:text-blue-600">
                  {recommendation.title}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{recommendation.path}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {typeInfo.label}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setFeedbackModal({ recommendation, isOpen: true });
                }}
              >
                <Star className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 mb-2">
            <Progress value={recommendation.score * 100} className="flex-1 h-1" />
            <span className="text-xs font-mono text-muted-foreground">
              {Math.round(recommendation.score * 100)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{recommendation.reasoning}</p>
          {recommendation.source_document_id && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="w-3 h-3" />
              <span>Based on document #{recommendation.source_document_id}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const ProfileSummary = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Interactions</p>
              <p className="text-2xl font-bold">{profileSummary.interaction_count || 0}</p>
            </div>
            <Eye className="w-8 h-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Top Topics</p>
              <p className="text-xs text-muted-foreground mt-1">
                {profileSummary.preferred_topics?.slice(0, 2).join(', ') || 'None yet'}
              </p>
            </div>
            <BookOpen className="w-8 h-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Engagement</p>
              <p className="text-2xl font-bold">{Math.round((profileSummary.engagement_level || 0) * 100)}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Frameworks</p>
              <p className="text-xs text-muted-foreground mt-1">
                {profileSummary.compliance_frameworks?.slice(0, 2).join(', ') || 'None yet'}
              </p>
            </div>
            <Target className="w-8 h-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Smart Recommendations</h1>
          <p className="text-muted-foreground">Personalized document suggestions based on your activity</p>
        </div>
        <Button onClick={loadRecommendations} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-6">
          <ProfileSummary />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Recommendation Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(RECOMMENDATION_TYPE_LABELS).map(([type, info]) => (
                      <Badge
                        key={type}
                        variant={selectedTypes.includes(type) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedTypes(prev => 
                            prev.includes(type) 
                              ? prev.filter(t => t !== type)
                              : [...prev, type]
                          );
                        }}
                      >
                        {info.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="context-doc">Context Document ID (optional)</Label>
                  <Input
                    id="context-doc"
                    placeholder="Enter document ID for similar recommendations"
                    value={contextDocumentId}
                    onChange={(e) => setContextDocumentId(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-2 bg-gray-200 rounded w-full"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recommendations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No recommendations yet</h3>
                <p className="text-muted-foreground">
                  Start interacting with documents to get personalized recommendations
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.map((recommendation) => (
                <RecommendationCard key={recommendation.recommendation_id} recommendation={recommendation} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          {preferences && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recommendation Types</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(RECOMMENDATION_TYPE_LABELS).map(([type, info]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <info.icon className="w-4 h-4" />
                        <span className="font-medium">{info.label}</span>
                      </div>
                      <Switch
                        checked={preferences.preferred_recommendation_types.includes(type)}
                        onCheckedChange={(checked) => {
                          const types = checked
                            ? [...preferences.preferred_recommendation_types, type]
                            : preferences.preferred_recommendation_types.filter(t => t !== type);
                          updatePreferences({ preferred_recommendation_types: types });
                        }}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Max Recommendations per Session</Label>
                    <Slider
                      value={[preferences.max_recommendations_per_session]}
                      onValueChange={([value]) => updatePreferences({ max_recommendations_per_session: value })}
                      min={5}
                      max={50}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Current: {preferences.max_recommendations_per_session}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Recommendation Frequency</Label>
                    <Select
                      value={preferences.recommendation_frequency}
                      onValueChange={(value) => updatePreferences({ recommendation_frequency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="real_time">Real Time</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="on_demand">On Demand</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">AI Explanations</span>
                      <Switch
                        checked={preferences.enable_ai_explanations}
                        onCheckedChange={(checked) => updatePreferences({ enable_ai_explanations: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Trending Documents</span>
                      <Switch
                        checked={preferences.enable_trend_based}
                        onCheckedChange={(checked) => updatePreferences({ enable_trend_based: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Collaborative Filtering</span>
                      <Switch
                        checked={preferences.enable_collaborative_filtering}
                        onCheckedChange={(checked) => updatePreferences({ enable_collaborative_filtering: checked })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analytics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Total Recommendations</p>
                        <p className="text-2xl font-bold">{analytics.total_recommendations}</p>
                      </div>
                      <BarChart3 className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Click-through Rate</p>
                        <p className="text-2xl font-bold">{Math.round(analytics.click_through_rate * 100)}%</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Average Rating</p>
                        <p className="text-2xl font-bold">{analytics.average_rating.toFixed(1)}</p>
                      </div>
                      <Star className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Active Users</p>
                        <p className="text-2xl font-bold">{analytics.user_engagement_metrics.active_users}</p>
                      </div>
                      <Users className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Top Recommendation Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.top_recommendation_types.map((type) => {
                      const typeInfo = getRecommendationTypeInfo(type.type);
                      return (
                        <div key={type.type} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <typeInfo.icon className="w-5 h-5" />
                            <div>
                              <p className="font-medium">{typeInfo.label}</p>
                              <p className="text-sm text-muted-foreground">
                                {type.count} recommendations, {type.clicks} clicks
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{Math.round(type.click_through_rate * 100)}%</p>
                            <p className="text-xs text-muted-foreground">CTR</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Feedback Modal */}
      {feedbackModal.isOpen && feedbackModal.recommendation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Rate Recommendation</CardTitle>
              <p className="text-sm text-muted-foreground">
                {feedbackModal.recommendation.title}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Rating</Label>
                <StarRating value={rating} onChange={setRating} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback-notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="feedback-notes"
                  placeholder="How helpful was this recommendation?"
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleFeedback} disabled={rating === 0} className="flex-1">
                  Submit Feedback
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFeedbackModal({ recommendation: null, isOpen: false });
                    setRating(0);
                    setFeedbackNotes('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}