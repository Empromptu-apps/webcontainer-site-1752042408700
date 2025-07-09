import React, { useState, useRef } from 'react';

const API_BASE = 'https://builder.impromptu-labs.com/api_tools';
const API_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer 4e31d5e989125dc49a09d234c59e85bc',
  'X-Generated-App-ID': '55f5147c-c93e-491d-b44a-f08659b4c489'
};

const DocumentSummarizer = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [apiLogs, setApiLogs] = useState([]);
  const [showRawData, setShowRawData] = useState(false);
  const [rawData, setRawData] = useState(null);
  const [createdObjects, setCreatedObjects] = useState([]);
  const fileInputRef = useRef(null);

  const logApiCall = (method, url, data, response) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      method,
      url,
      data,
      response,
      id: Date.now()
    };
    setApiLogs(prev => [...prev, logEntry]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError('');
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const processDocument = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setCurrentStep(2);
    setIsProcessing(true);
    setProgress(0);
    setError('');

    try {
      // Step 1: Read file content
      setProgress(20);
      const fileContent = await readFileContent(file);
      
      // Step 2: Ingest the file data
      setProgress(40);
      const ingestUrl = `${API_BASE}/input_data`;
      const ingestData = {
        created_object_name: 'uploaded_document',
        data_type: 'strings',
        input_data: [fileContent]
      };

      const ingestResponse = await fetch(ingestUrl, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(ingestData)
      });

      const ingestResult = await ingestResponse.json();
      logApiCall('POST', ingestUrl, ingestData, ingestResult);

      if (!ingestResponse.ok) {
        throw new Error(`Failed to upload document: ${ingestResult.message || 'Unknown error'}`);
      }

      setCreatedObjects(prev => [...prev, 'uploaded_document']);

      // Step 3: Generate summary
      setProgress(70);
      const promptUrl = `${API_BASE}/apply_prompt`;
      const promptData = {
        created_object_names: ['document_summary'],
        prompt_string: 'Analyze this document and identify the key topics/subjects discussed. Provide exactly 2 bullet points that summarize the main themes. Format as clean bullet points without any additional text or explanation: {uploaded_document}',
        inputs: [{
          input_object_name: 'uploaded_document',
          mode: 'combine_events'
        }]
      };

      const promptResponse = await fetch(promptUrl, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(promptData)
      });

      const promptResult = await promptResponse.json();
      logApiCall('POST', promptUrl, promptData, promptResult);

      if (!promptResponse.ok) {
        throw new Error(`Failed to generate summary: ${promptResult.message || 'Unknown error'}`);
      }

      setCreatedObjects(prev => [...prev, 'document_summary']);

      // Step 4: Retrieve the summary
      setProgress(90);
      const resultUrl = `${API_BASE}/return_data/document_summary`;
      const resultResponse = await fetch(resultUrl, {
        method: 'GET',
        headers: API_HEADERS
      });

      const result = await resultResponse.json();
      logApiCall('GET', resultUrl, null, result);

      if (!resultResponse.ok) {
        throw new Error(`Failed to retrieve summary: ${result.message || 'Unknown error'}`);
      }

      setRawData(result);
      setSummary(result.text_value);
      setProgress(100);
      setCurrentStep(3);

    } catch (err) {
      setError(err.message);
      setCurrentStep(1);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteObjects = async () => {
    try {
      for (const objectName of createdObjects) {
        const deleteUrl = `${API_BASE}/objects/${objectName}`;
        const deleteResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: API_HEADERS
        });
        const deleteResult = await deleteResponse.json();
        logApiCall('DELETE', deleteUrl, null, deleteResult);
      }
      setCreatedObjects([]);
      setSummary('');
      setRawData(null);
      setCurrentStep(1);
    } catch (err) {
      setError(`Failed to delete objects: ${err.message}`);
    }
  };

  const resetApp = () => {
    setCurrentStep(1);
    setFile(null);
    setSummary('');
    setError('');
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Document Summarizer
              </h1>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? '☀️' : '🌙'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= step 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-1 mx-2 ${
                      currentStep > step 
                        ? 'bg-primary-600' 
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step 1: File Upload */}
          {currentStep === 1 && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
                  Upload Your Document
                </h2>
                
                <div
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                    isDragOver 
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                      : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="text-6xl mb-4">📄</div>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
                    Drag and drop your file here, or
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    aria-label="Choose file to upload"
                  >
                    Choose File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv,.pdf,.docx,.xls,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                    aria-describedby="file-help"
                  />
                  <p id="file-help" className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                    Supports: TXT, CSV, PDF, DOCX, XLS, XLSX
                  </p>
                </div>

                {file && (
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={processDocument}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                        aria-label="Process document"
                      >
                        Process Document
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-800 dark:text-red-200">{error}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Processing */}
          {currentStep === 2 && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-6">
                  <div className="w-16 h-16 border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 rounded-full spinner"></div>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Processing Your Document
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Analyzing content and generating summary...
                </p>
                
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
                  <div 
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  ></div>
                </div>

                <button
                  onClick={() => {
                    setIsProcessing(false);
                    setCurrentStep(1);
                  }}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                  aria-label="Cancel processing"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {currentStep === 3 && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Document Summary
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Key Topics:
                    </h3>
                    <div 
                      className="prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: summary.replace(/\n/g, '<br>').replace(/•/g, '•') 
                      }}
                      aria-describedby="summary-description"
                    />
                    <p id="summary-description" className="sr-only">
                      AI-generated summary of document key topics
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={resetApp}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                      aria-label="Process another document"
                    >
                      Process Another Document
                    </button>
                    
                    <button
                      onClick={() => setShowRawData(!showRawData)}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                      aria-label="Show raw API data"
                    >
                      {showRawData ? 'Hide' : 'Show'} Raw Data
                    </button>
                    
                    <button
                      onClick={deleteObjects}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                      aria-label="Delete created objects"
                    >
                      Delete Objects
                    </button>
                  </div>

                  {showRawData && rawData && (
                    <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Raw API Response:</h4>
                      <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-x-auto">
                        {JSON.stringify(rawData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* API Logs */}
          {apiLogs.length > 0 && (
            <div className="mt-8 max-w-6xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    API Call Logs
                  </h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {apiLogs.map((log) => (
                    <div key={log.id} className="p-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {log.method} {log.url}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {log.data && (
                        <details className="mb-2">
                          <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                            Request Data
                          </summary>
                          <pre className="text-xs text-gray-600 dark:text-gray-400 mt-1 overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </details>
                      )}
                      <details>
                        <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                          Response
                        </summary>
                        <pre className="text-xs text-gray-600 dark:text-gray-400 mt-1 overflow-x-auto">
                          {JSON.stringify(log.response, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentSummarizer;
