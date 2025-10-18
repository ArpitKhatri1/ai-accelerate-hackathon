"use client"
import React from 'react'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const Navbar = () => {
    return (
        <div className='h-12 bg-red-100 flex items-center justify-between px-10 py-1'>

            <div>
                Logo</div>
            <div>
                Dashboard
            </div>

            {/* option to select dashboard */}
            <div>
                <Select>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select a fruit" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Fruits</SelectLabel>
                            <SelectItem value="Customer">Customer</SelectItem>
                            <SelectItem value="Enterprise">Enterprise</SelectItem>
        
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

        </div>
    )
}

export default Navbar