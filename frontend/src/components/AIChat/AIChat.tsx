import React from 'react'
import PromptInputComponent from './prompt-input'

const AIChat = () => {
  return (
    <div className='h-full bg-blue-100 max-w-[1200px] w-full flex'>
        <div className='mt-auto w-full'>

            <PromptInputComponent/>

        </div>
       
        
    </div>
  )
}

export default AIChat