// src/components/AIChat/prompt-input.tsx
'use client';

import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  type PromptInputMessage,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSpeechButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { GlobeIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { ChatChartRenderer } from './ChatChartRenderer';
import type { AgentMessageContent } from '@/lib/agent-types';
import { normalizeStructuredPayload } from '@/lib/agent-response';
import pdfToText from 'react-pdftotext';

// Extract text from a PDF attachment (FileUIPart) using react-pdftotext
async function extractPdfTextFromAttachment(file: { url: string; filename?: string; mediaType?: string }) {
  try {
    if (file.mediaType !== 'application/pdf') return null;

    // Fetch the blob from the FileUIPart URL
    const res = await fetch(file.url);
    const blob = await res.blob();

    // Use react-pdftotext to extract text
    const text = await pdfToText(blob);
    const header = `USER FILE ATTACHMENT: ${file.filename ?? 'document.pdf'}`;
    return `${header}\n\n${text.trim()}`;
  } catch (err) {
    console.error('[AIChat] Failed to extract PDF text', err);
    const header = `USER FILE ATTACHMENT: ${file.filename ?? 'document.pdf'}`;
    return `${header}\n\n<Failed to extract text from this PDF>`;
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: AgentMessageContent;
}

interface PromptInputComponentProps {
  layout?: 'page' | 'embedded';
  prefillText?: string;
}

const models = [
  { id: 'gpt-4', name: 'GPT-4' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  { id: 'claude-2', name: 'Claude 2' },
  { id: 'claude-instant', name: 'Claude Instant' },
  { id: 'palm-2', name: 'PaLM 2' },
  { id: 'llama-2-70b', name: 'Llama 2 70B' },
  { id: 'llama-2-13b', name: 'Llama 2 13B' },
  { id: 'cohere-command', name: 'Command' },
  { id: 'mistral-7b', name: 'Mistral 7B' },
];

const PromptInputComponent = ({ layout = 'page', prefillText }: PromptInputComponentProps) => {
  const [text, setText] = useState<string>('');
  const [model, setModel] = useState<string>(models[0].id);
  const [status, setStatus] = useState<'submitted' | 'streaming' | 'ready' | 'error'>('ready');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastPrefillRef = useRef<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (prefillText !== undefined && prefillText !== lastPrefillRef.current) {
      setText(prefillText);
      lastPrefillRef.current = prefillText;
      if (textareaRef.current) {
        textareaRef.current.focus({ preventScroll: true });
      }
    }
  }, [prefillText]);

  const stop = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStatus('ready');
  };

  const handleSubmit = async (message: PromptInputMessage) => {
    setText('');
    if (status === 'streaming' || status === 'submitted') {
      stop();
      return;
    }

    if (message.text === undefined || message.text.trim() === '') {
      return;
    }

    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    // Build final outgoing text, augmenting with extracted PDF text (if any),
    // while keeping the UI display concise.
    let outgoingText = message.text || '';
    let uiAttachmentLine = '';
    let attachedFileNames: string[] = [];
    if (message.files && message.files.length > 0) {
      const pdfParts = message.files.filter((f) => f.mediaType === 'application/pdf');
      if (pdfParts.length > 0) {
        attachedFileNames = pdfParts.map((f) => (f as { filename?: string }).filename || 'document.pdf');
        const extractedAll = await Promise.all(
          pdfParts.map((f) =>
            extractPdfTextFromAttachment({
              url: f.url,
              filename: (f as { filename?: string }).filename,
              mediaType: f.mediaType,
            })
          )
        );
        const joined = extractedAll.filter(Boolean).join('\n\n');
        if (joined.trim().length > 0) {
          outgoingText = `${outgoingText ? outgoingText + '\n\n' : ''}${joined}`;
        }

        // Create a short UI summary line listing the PDF names
        const names = attachedFileNames.join(', ');
        uiAttachmentLine = `Attached PDF${attachedFileNames.length > 1 ? 's' : ''}: ${names} (full contents sent to assistant).`;
      }
    }

    setStatus('submitted');

    const userMessage: ChatMessage = {
      role: 'user',
      content: {
        // Show a concise message in the UI, but keep the full text hidden in `raw`
        text: [message.text || '', uiAttachmentLine].filter(Boolean).join('\n\n') || undefined,
        raw: outgoingText,
      },
    };

    setMessages((prev) => [...prev, userMessage]);

    const historyPayload = [...messages, userMessage].map((m) => ({
      role: m.role,
      text: m.content?.text ?? '',
    }));

    try {
      const response = await fetch('http://localhost:8001/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: outgoingText,
          history: historyPayload,
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      setStatus('streaming');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let responseText = '';
      let structuredFromStream: AgentMessageContent | null = null;

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: { raw: '' },
        },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.substring(5));
              if (typeof data === 'string') {
                responseText += data;
              } else if (data && typeof data === 'object') {
                const payload = data as Record<string, unknown>;
                const rawCandidate = payload['raw'];
                if (typeof rawCandidate === 'string' && rawCandidate.length > 0) {
                  responseText = rawCandidate;
                } else {
                  const textCandidate = payload['text'];
                  if (typeof textCandidate === 'string') {
                    responseText += textCandidate;
                  }
                }

                const structuredCandidate = normalizeStructuredPayload(payload['structured']);
                if (structuredCandidate) {
                  structuredFromStream = structuredCandidate;
                }

                const errorCandidate = payload['error'];
                if (typeof errorCandidate === 'string' && errorCandidate.length > 0) {
                  console.error('Error from backend:', errorCandidate);
                  responseText = 'An error occurred while streaming.';
                  break;
                }
              }
            } catch (error) {
              console.error('Error parsing JSON chunk:', error);
            }
          }
        }
      }

      let cleanedText = responseText;
      const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = jsonRegex.exec(responseText);

      if (match && match[1]) {
        cleanedText = match[1];
      }

      const messageContent: AgentMessageContent = {
        raw: responseText,
      };

      if (structuredFromStream) {
        messageContent.text = structuredFromStream.text ?? messageContent.text;
        messageContent.charts = structuredFromStream.charts;
      }

      try {
        if (!messageContent.text || !messageContent.charts) {
          const potentialJson = JSON.parse(cleanedText) as unknown;
          const normalized = normalizeStructuredPayload(potentialJson);
          if (normalized) {
            messageContent.text = messageContent.text ?? normalized.text;
            messageContent.charts = messageContent.charts ?? normalized.charts;
          }
        }
      } catch (parseError) {
        console.debug('Failed to parse assistant payload as JSON.', parseError);
      }

      if (!messageContent.text) {
        messageContent.text = cleanedText.trim() ? cleanedText : responseText;
      }

      setMessages((prev) => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        if (lastIndex >= 0) {
          const lastMessage = newMessages[lastIndex];
          newMessages[lastIndex] = {
            ...lastMessage,
            content: messageContent,
          };
        }
        return newMessages;
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setStatus('error');
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        if (lastIndex >= 0) {
          const lastMessage = newMessages[lastIndex];
          newMessages[lastIndex] = {
            ...lastMessage,
            content: {
              ...lastMessage.content,
              text: 'An error occurred. Please try again.',
            },
          };
        }
        return newMessages;
      });
    } finally {
      setStatus('ready');
    }
  };

  const isEmbedded = layout === 'embedded';

  const chatPanel = (
    <div className={`flex flex-col w-full rounded-lg bg-white ${isEmbedded ? 'h-full' : 'h-[86vh]'}`}>
      <div className="flex-1 w-full overflow-y-auto p-4 space-y-6 flex flex-col-reverse">
        {[...messages].reverse().map((msg, index) => (
          <div
            key={index}
            className={`flex mb-4 ${msg.role === 'user' ? 'ml-auto w-4/6 justify-end' : 'justify-start'}`}
          >
            <div
              className={`rounded-lg p-4 ${
                msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'
              }`}
            >
              {(() => {
                const content = msg.content ?? {};
                const textToRender = content.text ?? (typeof content.raw === 'string' ? content.raw : '');

                return (
                  <>
                    {textToRender && (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {textToRender}
                      </ReactMarkdown>
                    )}
                    {Array.isArray(content.charts) && content.charts.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {content.charts.map((chart, chartIndex) => (
                          <ChatChartRenderer
                            key={chart.id ?? `${index}-chart-${chartIndex}`}
                            chart={chart}
                          />
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t bg-white">
        <PromptInput globalDrop multiple onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
            <PromptInputTextarea onChange={(event) => setText(event.target.value)} ref={textareaRef} value={text} />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
          
            </PromptInputTools>
            <PromptInputSubmit className="!h-8" status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );

  if (isEmbedded) {
    return <div className="flex h-full w-full flex-col">{chatPanel}</div>;
  }

  return (
    <div className="flex min-h-screen w-full flex-col py-5">
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 sm:px-6 lg:px-8">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">AI Assistant</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ask questions, explore insights, and generate charts powered by your data.
          </p>
        </header>

        <div className="flex-1 overflow-hidden rounded-2xl border shadow-xl shadow-slate-200/40">
          {chatPanel}
        </div>
      </div>
    </div>
  );
};

export default PromptInputComponent;