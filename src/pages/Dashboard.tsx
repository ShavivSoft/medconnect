import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Heart, Activity, Thermometer, Droplets, Server,
  CheckCircle2, XCircle, Loader2, Bluetooth, Watch,
  Footprints, Zap, Brain, Wind, Wifi, WifiOff, Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { checkHealth, HealthCheckResponse } from "@/lib/api";
import { supabase, SUPABASE_ENABLED } from "@/lib/supabase";
import { HealthSyncManager } from '@/components/HealthSyncManager';
import { VitalsReading } from '@/lib/types';

// Enhanced Vitals State Type
interface UnifiedVitals extends VitalsReading {
  recordedAt?: string;
  source?: string;
  device_status?: string;
}

const MetricCard = ({
  icon, label, value, unit, status, recordedAt, colorClass = "text-slate-900"
}: {
  icon: React.ReactNode; label: string; value?: number | string; unit: string;
  status?: string; recordedAt?: string; colorClass?: string;
}) => {
  const elapsed = recordedAt ? Math.round((Date.now() - new Date(recordedAt).getTime()) / 1000) : null;
  const isStale = elapsed !== null && elapsed > 60; // 1 min

  return (
    <Card className={`transition-all duration-300 ${value ? "border-emerald-500/20 shadow-sm" : "opacity-60 bg-slate-50/50"}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {icon} {label}
            {value && !isStale && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse ml-1" title="Live data" />}
          </div>
          {elapsed !== null && (
            <div className={`text-[9px] font-medium flex items-center gap-1 ${isStale ? "text-amber-500" : "text-slate-400"}`}>
              <Clock className="h-2.5 w-2.5" />
              {elapsed < 60 ? `${elapsed}s ago` : `${Math.floor(elapsed / 60)}m ago`}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <p className={`text-3xl font-bold tracking-tight ${value ? colorClass : "text-slate-300"}`}>
            {value || "--"}
          </p>
          <span className="text-xs text-muted-foreground font-medium">{unit}</span>
        </div>
        {!value && (
          <p className="text-[9px] text-slate-400 mt-2 italic flex items-center gap-1">
            Waiting for measurement...
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const [vitals, setVitals] = useState<UnifiedVitals | null>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [backendInfo, setBackendInfo] = useState<HealthCheckResponse | null>(null);
  const [useLiveSync, setUseLiveSync] = useState(true);

  const auth = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("connectcare_auth") || "{}");
    } catch { return {}; }
  }, []);

  const patientId = auth.patient_id || auth.user_id || "demo_patient_001";
  const patientDisplayName = auth.name || "Patient";

  const processReading = useCallback((data: any) => {
    // Only accept if recent (within 24 hours to prevent clock skew issues)
    const recAt = data.recorded_at || data.timestamp || new Date().toISOString();
    const diff = Math.abs(Date.now() - new Date(recAt).getTime());
    if (diff > 86400000) return;

    setVitals(prev => ({
      ...prev,
      ...data,
      heart_rate: data.heart_rate ?? prev?.heart_rate,
      systolic_bp: data.systolic_bp ?? prev?.systolic_bp,
      diastolic_bp: data.diastolic_bp ?? prev?.diastolic_bp,
      temperature_f: data.temperature_f ?? prev?.temperature_f,
      spo2: data.spo2 ?? prev?.spo2,
      step_count: data.step_count ?? prev?.step_count,
      calories_burned: data.calories_burned ?? prev?.calories_burned,
      stress_score: data.stress_score ?? prev?.stress_score,
      hrv: data.hrv ?? prev?.hrv,
      source: data.source || prev?.source,
      recordedAt: recAt,
      device_status: data.device_status || prev?.device_status || 'Connected'
    }));
  }, []);

  // Real-world data integration
  useEffect(() => {
    // 1. Listen for local Bluetooth scans / Sync Manager (BroadcastChannel)
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`medconnect_vitals_${patientId}`);
      bc.onmessage = (evt) => processReading(evt.data);
    } catch (e) { console.error("BC error", e); }

    // 2. Listen for remote IoT updates (Supabase)
    let channel: any = null;
    if (SUPABASE_ENABLED && supabase) {
      // Subscription
      channel = supabase.channel(`dashboard-vitals-${patientId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'vitals',
          filter: `patient_id=eq.${patientId}`
        }, (payload) => processReading(payload.new))
        .subscribe();
    }

    return () => {
      bc?.close();
      if (channel) supabase?.removeChannel(channel);
    };
  }, [patientId, processReading]);

  // Backend health check
  const pingBackend = useCallback(async () => {
    try {
      const info = await checkHealth();
      setBackendStatus('online');
      setBackendInfo(info);
    } catch {
      setBackendStatus('offline');
      setBackendInfo(null);
    }
  }, []);

  useEffect(() => {
    pingBackend();
    const interval = setInterval(pingBackend, 30_000);
    return () => clearInterval(interval);
  }, [pingBackend]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Background Health Framework Sync Service */}
      {useLiveSync && <HealthSyncManager />}

      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Health Dashboard</h1>
            <p className="text-slate-500 font-medium">Monitoring {patientDisplayName} (ID: {patientId})</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white rounded-full p-1 border shadow-sm pr-4">
              <div className={`p-2 rounded-full ${vitals?.device_status === 'Syncing' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                <Watch className={`h-4 w-4 ${vitals?.device_status === 'Syncing' ? 'text-blue-600 animate-bounce' : 'text-slate-500'}`} />
              </div>
              <div className="ml-2 flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-400 leading-none">DEVICE STATUS</span>
                <span className={`text-[11px] font-bold leading-none mt-1 ${vitals?.device_status === 'Disconnected' ? 'text-red-500' : 'text-emerald-500'}`}>
                  {vitals?.device_status || 'Connected'}
                </span>
              </div>
            </div>

            <div className="flex bg-white rounded-full p-1 border shadow-sm pr-4">
              <div className={`p-2 rounded-full ${useLiveSync ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                <Wifi className={`h-4 w-4 ${useLiveSync ? 'text-emerald-600' : 'text-amber-600'}`} />
              </div>
              <div className="ml-2 flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-400 leading-none">NATIVE SYNC</span>
                <span className={`text-[11px] font-bold leading-none mt-1 ${useLiveSync ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {useLiveSync ? 'ACTIVE' : 'IDLE'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Vitals Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            icon={<Heart className="h-4 w-4 text-red-500" />}
            label="Heart Rate"
            value={vitals?.heart_rate}
            unit="bpm"
            recordedAt={vitals?.recordedAt}
            colorClass="text-red-600"
          />
          <MetricCard
            icon={<Droplets className="h-4 w-4 text-cyan-500" />}
            label="Oxygen Saturation"
            value={vitals?.spo2}
            unit="%"
            recordedAt={vitals?.recordedAt}
            colorClass="text-cyan-600"
          />
          <MetricCard
            icon={<Activity className="h-4 w-4 text-blue-500" />}
            label="Blood Pressure"
            value={vitals?.systolic_bp ? `${vitals.systolic_bp}/${vitals.diastolic_bp}` : undefined}
            unit="mmHg"
            recordedAt={vitals?.recordedAt}
            colorClass="text-blue-600"
          />
          <MetricCard
            icon={<Thermometer className="h-4 w-4 text-orange-500" />}
            label="Skin Temperature"
            value={vitals?.temperature_f}
            unit="°F"
            recordedAt={vitals?.recordedAt}
            colorClass="text-orange-600"
          />
        </div>

        {/* Wearable Activity Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <MetricCard
            icon={<Footprints className="h-4 w-4 text-emerald-500" />}
            label="Daily Steps"
            value={vitals?.step_count ? vitals.step_count.toLocaleString() : undefined}
            unit="steps"
            recordedAt={vitals?.recordedAt}
            colorClass="text-emerald-600"
          />
          <MetricCard
            icon={<Zap className="h-4 w-4 text-amber-500" />}
            label="Calories Burned"
            value={vitals?.calories_burned}
            unit="kcal"
            recordedAt={vitals?.recordedAt}
            colorClass="text-amber-600"
          />
          <MetricCard
            icon={<Brain className="h-4 w-4 text-indigo-500" />}
            label="Stress Level"
            value={vitals?.stress_score}
            unit="score"
            recordedAt={vitals?.recordedAt}
            colorClass="text-indigo-600"
          />
          <MetricCard
            icon={<Wind className="h-4 w-4 text-violet-500" />}
            label="Respiratory Rate"
            value={vitals?.respiratory_rate}
            unit="/min"
            recordedAt={vitals?.recordedAt}
            colorClass="text-violet-600"
          />
        </div>

        {/* System Summary Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Backend Status Card */}
          <Card className="border-slate-200">
            <CardHeader className="border-b bg-slate-50/50 py-4">
              <CardTitle className="flex items-center gap-2 text-sm text-slate-600">
                <Server className="h-4 w-4" /> AI Backend Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  {backendStatus === 'checking' && (
                    <><Loader2 className="h-4 w-4 animate-spin text-slate-400" /><span className="text-sm text-muted-foreground">Checking...</span></>
                  )}
                  {backendStatus === 'online' && (
                    <><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-sm font-bold text-green-600 uppercase tracking-tight">System Online</span></>
                  )}
                  {backendStatus === 'offline' && (
                    <><XCircle className="h-4 w-4 text-red-500" /><span className="text-sm font-bold text-red-600 uppercase tracking-tight">System Offline</span></>
                  )}
                </div>

                {backendStatus === 'online' && backendInfo?.services && (
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="bg-white border-slate-200 text-[9px]">OCR</Badge>
                    <Badge variant="outline" className="bg-white border-slate-200 text-[9px]">NLP</Badge>
                    <Badge variant="outline" className="bg-white border-slate-200 text-[9px]">DIAGNOSTIC AI</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Device Context Card */}
          <Card className="border-slate-200">
            <CardHeader className="border-b bg-slate-50/50 py-4">
              <CardTitle className="flex items-center gap-2 text-sm text-slate-600">
                <Bluetooth className="h-4 w-4" /> Wearable Sources
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Watch className="h-5 w-5 text-teal-500" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-tight">MedConnect Virtual Watch</p>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Firmware v2.4.1 · BT LE 5.0</p>
                  </div>
                </div>
                <Link
                  to="/bridge"
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100 transition-colors uppercase"
                >
                  Manage Devices
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <div className="h-1 w-20 bg-slate-200 mx-auto rounded-full mb-6"></div>
          <p className="text-sm text-slate-500">
            Need to analyze a new medical report? <Link to="/reports" className="text-blue-600 font-bold hover:underline">Upload here →</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;