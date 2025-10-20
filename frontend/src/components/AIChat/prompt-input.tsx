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
import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { ChatChartRenderer } from './ChatChartRenderer';
import type { AgentMessageContent } from '@/lib/agent-types';
import { normalizeStructuredPayload } from '@/lib/agent-response';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: AgentMessageContent;
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

const PromptInputComponent = () => {
  const [text, setText] = useState<string>('');
  const [model, setModel] = useState<string>(models[0].id);
  const [status, setStatus] = useState<
    'submitted' | 'streaming' | 'ready' | 'error'
  >('ready');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const stop = () => {
    console.log('Stopping request...');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStatus('ready');
  };

  // Use the entire handleSubmit from the "newly produced code"
  // as it contains the advanced parsing logic for CombinedMessageContent
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

    setStatus('submitted');

    const userMessage: ChatMessage = {
      role: 'user',
      content: {
        text: message.text || '',
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
          message: message.text || '',
          history: historyPayload,
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      setStatus('streaming');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let responseText = ''; // Accumulates the full raw response
  let structuredFromStream: AgentMessageContent | null = null;

      // Add a placeholder for the assistant's message
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
        console.debug('[AIChat] Received chunk', chunk);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.substring(5));
              console.debug('[AIChat] Parsed SSE line', data);
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
            } catch (e) {
              console.error('Error parsing JSON chunk:', e);
            }
          }
        }
      }

      // --- FIX: Clean and Parse the final text (from new code) ---
      let cleanedText = responseText;
      const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = jsonRegex.exec(responseText);

      if (match && match[1]) {
        cleanedText = match[1];
      }

      console.debug('[AIChat] Raw responseText', responseText);
      console.debug('[AIChat] Cleaned text candidate', cleanedText);

      // Now, try to parse the cleanedText as the CombinedMessageContent
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
      console.debug('[AIChat] Final message content constructed', messageContent);
      // --- End of Fix ---

      // Update state ONCE with the final, parsed content
      setMessages((prev) => {
        const newMessages = [...prev];
        // Store the parsed content directly in the text field
        const lastIndex = newMessages.length - 1;
        if (lastIndex >= 0) {
          const lastMessage = newMessages[lastIndex];
          newMessages[lastIndex] = {
            ...lastMessage,
            content: messageContent,
          };
        }
        console.log('Final content being set:', messageContent);
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

  return (
    // Use layout from new code
    <div className="flex flex-col w-full justify-end  bg-white h-fit rounded-lg">
      {/* Use message rendering from new code */}
      <div className="p-4 space-y-4 overflow-y-auto w-full">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.role === 'user' ? 'justify-end w-4/6 ml-auto' : 'justify-start'
            }`}
          >
            <div
              className={`p-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-black'
              }`}
            >
              {(() => {
                // This logic handles rendering for both user (string)
                // and assistant (string | CombinedMessageContent)
                const content = msg.content ?? {};
                const textToRender =
                  content.text ?? (typeof content.raw === 'string' ? content.raw : '');

                return (
                  <>
                    {textToRender && (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {textToRender}
                      </ReactMarkdown>
                    )}
                    {Array.isArray(content.charts) &&
                      content.charts.length > 0 && (
                        <div className="mt-3 space-y-3">
                          {content.charts.map((chart, chartIndex) => (
                            <ChatChartRenderer
                              key={chart.id ?? `${i}-chart-${chartIndex}`}
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

      {/* Use PromptInput structure from old code */}
      <PromptInput globalDrop multiple onSubmit={handleSubmit}>
        <PromptInputBody>
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>
          <PromptInputTextarea
            onChange={(e) => setText(e.target.value)}
            ref={textareaRef}
            value={text}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <PromptInputSpeechButton
              onTranscriptionChange={setText}
              textareaRef={textareaRef}
            />
            <PromptInputButton>
              <GlobeIcon size={16} />
              <span>Search</span>
            </PromptInputButton>
            <PromptInputModelSelect onValueChange={setModel} value={model}>
              <PromptInputModelSelectTrigger>
                <PromptInputModelSelectValue />
              </PromptInputModelSelectTrigger>
              <PromptInputModelSelectContent>
                {models.map((modelOption) => (
                  <PromptInputModelSelectItem
                    key={modelOption.id}
                    value={modelOption.id}
                  >
                    {modelOption.name}
                  </PromptInputModelSelectItem>
                ))}
              </PromptInputModelSelectContent>
            </PromptInputModelSelect>
          </PromptInputTools>
          <PromptInputSubmit className="!h-8" status={status} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
};

export default PromptInputComponent;