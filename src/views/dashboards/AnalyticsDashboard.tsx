import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/Skeleton';
import apiClient from '../../api/apiClient';

export function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await apiClient.get('/analytics/tat');
    } catch (error) {
      console.error('Analytics error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-text-muted">Real-time system performance</p>
        </div>
        <Button onClick={loadData}>Refresh Data</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Key Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-8 border rounded-lg">
            <div className="text-3xl font-bold mb-2">Loading...</div>
            <div className="text-sm text-text-muted">Prescriptions</div>
          </div>
          <div className="text-center p-8 border rounded-lg">
            <div className="text-3xl font-bold mb-2">Loading...</div>
            <div className="text-sm text-text-muted">Avg TAT</div>
          </div>
          <div className="text-center p-8 border rounded-lg">
            <div className="text-3xl font-bold mb-2">Loading...</div>
            <div className="text-sm text-text-muted">Compliance</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance Charts</CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center text-text-muted">
          Charts populate from backend analytics API.
        </CardContent>
      </Card>
    </div>
  );
}
