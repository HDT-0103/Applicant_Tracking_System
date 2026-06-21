import React, {createContext, useContext, useState, useEffect} from 'react';

export type IngestionStatus = 'IDLE'| 'LOADING' | 'SUCCESS' | 'ERROR';

interface CandidateAnalytics {
    uuid: string;
    fullName: string;
    affinityScore: number;
    skills: {name: string, score: number}[];
    trajectory: any[];
}

interface WorkspaceContextProps {
    status: IngestionStatus;
    pdfUrl: string | null;
    analyticData: CandidateAnalytics | null;
    errorMessage: string | null;
    uploadResume: (file: File) => Promise<void>;
    resetWorkspace : ()=>void;
}

const WorkspaceContext = createContext<WorkspaceContextProps | undefined> (undefined);

export const WorkspaceProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const [status, setStatus] = useState<IngestionStatus>('IDLE');
    const [pdfUrl, setPdfUrl] = useState<string|null> (null);
    const [analyticData, setAnalyticData] = useState<CandidateAnalytics | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const uploadResume = async (file: File) => {
        setStatus('LOADING');
        setErrorMessage(null);
        
        const formData = new FormData();
        formData.append('resume', file);

        try{
            const response = await fetch('/api/v1/ingest', {
                method: 'POST',
                body: formData
            });
            if (!response.ok){
                const errorData = await response.json();
                throw new Error(errorData.message || 'Upload failed');
            }

            const result = await response.json();
            setPdfUrl(URL.createObjectURL(file));

            initWebSocketPipeline(result.candidateUuid);
        }
        catch (error: any)
        {
            setStatus('ERROR');
            setErrorMessage(error.message);
        }
    }

    const initWebSocketPipeline = (uuid: string) => {
        const ws = new WebSocket ('wss://ats.internal:8421/stream/${uuid}');

        ws.onmessage = (event) =>{
            const payload = JSON.parse(event.data);
            if (payload.type === 'AI_ANALYTICS_COMPLETE'){
                setAnalyticData(payload.data);
                setStatus('SUCCESS');
                ws.close();
            }
        };

        ws.onerror = () => {
            setStatus('ERROR');
            setErrorMessage('Asynchronous Engine Failure: WebSocket handshake or processing timeout!');
            ws.close();
        }

        setTimeout(() =>{
            if (status === 'LOADING'){
                ws.close();
                setStatus('ERROR');
                setErrorMessage('Processing Timeout exceeded client-side thresholds!');
            }
        }, 30000);
    };

    const resetWorkspace = () => {
        setStatus('IDLE');
        setPdfUrl(null);
        setAnalyticData(null);
        setErrorMessage(null);
    }

    return (
        <WorkspaceContext.Provider value {{status, pdfUrl, analyticsData, errorMessage, uploadResume, resetWorkspace}}>
            {children}
        </WorkspaceContext.Provider>
    );
};

export const useWorkspace = () => {
    const context = useContext(WorkspaceContext);
    if (!context) throw new Error('useWorkspace must be used within a WorkspaceProvider');
    return context;
};