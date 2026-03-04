import React, { useEffect, useState, useCallback, useRef } from 'react';
import { apiSubmitVitals, loadAuthFromStorage } from '@/lib/connectCareApi';
import { VitalsReading } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

/**
 * HealthSyncManager — SIMULATED Mobile Health Framework Sync Layer
 * This component runs in the background of the dashboard.
 * It periodically fetches data from the "Native Health Framework" (simulated)
 * and pushes it to the MedConnect Backend.
 */

interface SyncConfig {
    heartRateInterval: number;
    spo2Interval: number;
    stepsInterval: number;
    activityInterval: number;
}

const DEFAULT_CONFIG: SyncConfig = {
    heartRateInterval: 15_000, // 15s
    spo2Interval: 45_000,      // 45s
    stepsInterval: 60_000,     // 1m
    activityInterval: 120_000, // 2m
};

export const HealthSyncManager: React.FC = () => {
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<Record<string, Date>>({});
    const [deviceStatus, setDeviceStatus] = useState<'Connected' | 'Syncing' | 'No Data' | 'Not Worn'>('Connected');

    // Use refs to avoid closure staleness in intervals
    const statusRef = useRef(deviceStatus);
    const syncRef = useRef(isSyncing);

    useEffect(() => {
        statusRef.current = deviceStatus;
        syncRef.current = isSyncing;
    }, [deviceStatus, isSyncing]);

    const auth = loadAuthFromStorage();
    const patientId = auth?.patient_id || auth?.user_id || 'demo_patient';

    const pushReading = useCallback(async (reading: Partial<VitalsReading>) => {
        if (!patientId) return;

        const payload = {
            ...reading,
            patient_id: patientId,
            timestamp: new Date().toISOString(),
            source: 'HealthFramework (Simulated)',
            device_status: statusRef.current,
            source_device_model: 'MedConnect Virtual Watch'
        };

        try {
            await apiSubmitVitals(payload as any);
            console.log(`[HealthSync] Pushed ${Object.keys(reading).join(', ')} to backend.`);

            // Broadcast locally for instant UI update even if server push takes time
            const bc = new BroadcastChannel(`medconnect_vitals_${patientId}`);
            bc.postMessage({
                ...payload,
                recorded_at: payload.timestamp
            });
            bc.close();

            setLastSync(prev => ({ ...prev, [Object.keys(reading)[0]]: new Date() }));
        } catch (err) {
            console.error('[HealthSync] Push failed:', err);
        }
    }, [patientId]);

    // ── Simulated Health Framework Generators ──────────────────────────────
    const generateHR = () => {
        const base = 72;
        const drift = Math.sin(Date.now() / 100000) * 10;
        const jitter = (Math.random() - 0.5) * 4;
        return Math.round(base + drift + jitter);
    };

    const generateSpO2 = () => {
        const base = 98.5;
        const jitter = (Math.random() - 0.5) * 1.5;
        return Math.min(100, Math.max(90, Math.round((base + jitter) * 10) / 10));
    };

    const generateSteps = () => {
        // Accumulate steps over time
        const existing = parseInt(localStorage.getItem('sim_steps') || '2540');
        const added = Math.floor(Math.random() * 50);
        const newTotal = existing + added;
        localStorage.setItem('sim_steps', newTotal.toString());
        return newTotal;
    };

    const generateActivity = () => {
        const metrics = {
            calories_burned: Math.floor(Math.random() * 5 + 1),
            stress_score: Math.floor(Math.random() * 40 + 20),
            hrv: Math.floor(Math.random() * 20 + 40)
        };
        return metrics;
    };

    // ── Sync Loops ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!auth) return;

        // Start Sync
        setIsSyncing(true);
        toast({
            title: "Health Sync Active",
            description: "Native health data is now syncing in near real-time.",
        });

        // 1. Heart Rate (Fast)
        const hrInt = setInterval(() => {
            if (Math.random() > 0.1) { // 90% chance device is "worn"
                setDeviceStatus('Syncing');
                pushReading({ heart_rate: generateHR() });
                setTimeout(() => setDeviceStatus('Connected'), 2000);
            } else {
                setDeviceStatus('Not Worn');
            }
        }, DEFAULT_CONFIG.heartRateInterval);

        // 2. SpO2 (Medium)
        const spo2Int = setInterval(() => {
            pushReading({ spo2: generateSpO2() });
        }, DEFAULT_CONFIG.spo2Interval);

        // 3. Steps (Slow)
        const stepsInt = setInterval(() => {
            pushReading({ step_count: generateSteps(), distance_m: Math.floor(Math.random() * 100 + 50) });
        }, DEFAULT_CONFIG.stepsInterval);

        // 4. Activity (Occasional)
        const actInt = setInterval(() => {
            pushReading(generateActivity());
        }, DEFAULT_CONFIG.activityInterval);

        return () => {
            clearInterval(hrInt);
            clearInterval(spo2Int);
            clearInterval(stepsInt);
            clearInterval(actInt);
            setIsSyncing(false);
        };
    }, [auth, patientId]);

    return null; // Background worker
};
