import Link from 'next/link'
import React from 'react'
import { Home, Inbox, MessageCircle } from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarTrigger,
} from "@/components/ui/sidebar"

const AppSidebar = () => {
    const items = [
        {
            title: "Dashboard",
            url: "/",
            icon: Home,
        },
        {
            title: "Analytics WorkFlow",
            url: "/analytics",
            icon: Inbox,
        },
        {
            title: "AI Chat",
            url: "/ai-chat",
            icon: MessageCircle,
        },
     
    ]
    return (
        <Sidebar className='' collapsible='icon' >
            <SidebarContent >
                <SidebarGroup>

                    <SidebarGroupContent>

                        <SidebarMenu>
                                <SidebarTrigger />
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <Link href={item.url}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    )
}

export default AppSidebar