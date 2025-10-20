"use client";

import Link from "next/link";
import React from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";

const Navbar = () => {
    return (
        <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div className="text-lg font-semibold text-slate-900">SynthSight</div>

            <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
                <Link href="/">Dashboard</Link>
                <Link href="/analytics">Analytics Workflow</Link>
                <Link href="/ai-chat">AI Chat</Link>
            </div>

            <div className="flex items-center gap-3">
                <Select>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Choose dataset" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Datasets</SelectLabel>
                            <SelectItem value="Customer">Customer</SelectItem>
                            <SelectItem value="Enterprise">Enterprise</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
                <Button asChild size="sm" variant="default">
                    <Link href="/ai-chat">Open AI Chat</Link>
                </Button>
            </div>
        </div>
    );
};

export default Navbar;