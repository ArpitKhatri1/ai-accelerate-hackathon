import PromptInputComponent from './prompt-input';

const AIChat = () => {
  return (
    <div className="flex min-h-screen w-full flex-col py-5">
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex-1 overflow-hidden rounded-2xl shadow-xl shadow-slate-200/40">
          <PromptInputComponent />
        </div>
      </div>
    </div>
  );
};

export default AIChat;