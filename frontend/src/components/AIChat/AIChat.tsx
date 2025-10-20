import PromptInputComponent from './prompt-input';

const AIChat = () => {
  return (
    <div className="flex min-h-screen w-full flex-col bg-gradient-to-br from-slate-100 via-white to-sky-100 py-12">
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 sm:px-6 lg:px-8">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">AI Assistant</h1>
          <p className="mt-2 text-sm text-slate-600">Ask questions, explore insights, and generate charts powered by your data.</p>
        </header>

        <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40">
          <PromptInputComponent />
        </div>
      </div>
    </div>
  );
};

export default AIChat;