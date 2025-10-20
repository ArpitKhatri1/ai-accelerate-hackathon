import React from 'react'
import PromptInputComponent from './prompt-input'

const AIChat = () => {
  return (
    <div className='h-full bg-blue-100 max-w-[1200px] w-full flex flex-col'>
        <div className='h-full w-full bg-red-100 overflow-y-scroll'>

        </div>
        <div className='mt-auto w-full1'>

            <PromptInputComponent/>

        </div>
       
        
    </div>
  )
}

export default AIChat