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
import { AIBarChart } from './AIBarChart'; // Import from new code

// Define the expected combined message structure (from new code)
interface CombinedMessageContent {
  text?: string;
  chart?: {
    type: 'bar'; // Extend this if you add more chart types
    data: any[];
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string | CombinedMessageContent; // Allow both string and combined content
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

const SUBMITTING_TIMEOUT = 200;
const STREAMING_TIMEOUT = 2000;

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
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: message.text || '' }, // User message is always string
    ]);

    try {
      const response = await fetch('http://localhost:8001/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: message.text || '', 
          history: messages.map(m => ({ text: m.text, role: m.role }))  // Send history
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      setStatus('streaming');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let responseText = ''; // Accumulates the full raw response

      // Add a placeholder for the assistant's message
      setMessages((prev) => [...prev, { role: 'assistant', text: '' as string | CombinedMessageContent }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.substring(5));
              if (data.text) {
                responseText += data.text;
              } else if (data.error) {
                console.error('Error from backend:', data.error);
                responseText = 'An error occurred while streaming.';
                break;
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

      // Now, try to parse the cleanedText as the CombinedMessageContent
      let parsedContent: CombinedMessageContent | string = cleanedText;
      try {
        const potentialJson = JSON.parse(cleanedText);
        // Check if it matches our expected structure for combined content
        if (potentialJson && (potentialJson.text || potentialJson.chart)) {
          parsedContent = potentialJson as CombinedMessageContent;
        } else if (
          potentialJson &&
          potentialJson.type === 'bar' &&
          potentialJson.data
        ) {
          // Handle cases where the agent *still* returns just chart JSON (old behavior)
          parsedContent = { chart: potentialJson };
        }
      } catch (e) {
        // Not a JSON object, so `cleanedText` remains a string
      }
      // --- End of Fix ---

      // Update state ONCE with the final, parsed content
      setMessages((prev) => {
        const newMessages = [...prev];
        // Store the parsed content directly in the text field
        newMessages[newMessages.length - 1] = {
          ...newMessages[newMessages.length - 1],
          text: parsedContent, // Store the object/string here
        };
        console.log('Final content being set:', parsedContent);
        return newMessages;
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setStatus('error');
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          ...newMessages[newMessages.length - 1],
          text: 'An error occurred. Please try again.',
        };
        return newMessages;
      });
    } finally {
      setStatus('ready');
    }
  };

  return (
    // Use layout from new code
    <div className="flex flex-col justify-end size-full bg-white h-fit rounded-lg">
      {/* Use message rendering from new code */}
      <div className="p-4 space-y-4 overflow-y-auto">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
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
                let content: CombinedMessageContent | string = msg.text || '';

                // User messages are always strings, but assistant messages
                // might be pre-parsed objects.
                // This logic handles both cases gracefully.
                if (typeof msg.text === 'string' && msg.role === 'assistant') {
                  try {
                    // Try to parse if it's a string (e.g., streaming placeholder or error)
                    const parsed = JSON.parse(msg.text);
                    if (parsed && (parsed.text || parsed.chart)) {
                      content = parsed as CombinedMessageContent;
                    } else if (
                      parsed &&
                      parsed.type === 'bar' &&
                      parsed.data
                    ) {
                      // Still handle direct chart JSON if agent sends it
                      content = { chart: parsed };
                    }
                  } catch (e) {
                    // Not JSON, or not our structured JSON, leave as string
                  }
                }

                // Render based on the final content type
                return (
                  <>
                    {typeof content === 'string' && (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content}
                      </ReactMarkdown>
                    )}
                    {typeof content === 'object' && content.text && (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content.text}
                      </ReactMarkdown>
                    )}
                    {typeof content === 'object' &&
                      content.chart &&
                      content.chart.type === 'bar' && (
                        <div className="mt-2">
                          {/* Add some spacing */}
                          <AIBarChart data={content.chart.data} />
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