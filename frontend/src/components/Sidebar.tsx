import React from 'react'
import { Calendar, Home, Inbox, Search, Settings } from "lucide-react"

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
     
    ]
    return (
        <Sidebar className='fixed left-0 top-0' collapsible='icon' >
            <SidebarContent >
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation
                    
                    </SidebarGroupLabel>
                    <SidebarGroupContent>

                        <SidebarMenu>
                                <SidebarTrigger />
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <a href={item.url}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </a>
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