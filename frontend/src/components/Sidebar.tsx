"use client"
import Link from 'next/link'
import React from 'react'
import { usePathname } from 'next/navigation'
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
    const pathname = usePathname()
    
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
        <Sidebar  collapsible='icon' >
            <SidebarContent  >
                <SidebarGroup>

                    <SidebarGroupContent>

                        <SidebarMenu>
                                <SidebarTrigger />
                            {items.map((item) => {
                                const isActive = pathname === item.url || 
                                    (item.url !== "/" && pathname.startsWith(item.url))
                                    console.log("isActive", item.url, pathname, isActive)
                                return (
                                    <SidebarMenuItem key={item.title} className=''>
                                        <SidebarMenuButton asChild className={isActive ? "  bg-blue-400 text-white hover:bg-blue-400/90 hover:text-white rounded-md" : "" }>
                                            <Link href={item.url}>
                                                <item.icon className={isActive ? "text-white" : ""} />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    )
}

export default AppSidebar