"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Users, MessageSquare } from "lucide-react";
import { chatApi, type Chat } from "@/lib/chat-api";
import { employeeApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Define the expected profile type based on API response
interface UserProfile {
  _id: string;
  username: string;
  email: string;
  avatar?: {
    public_id: string;
    url: string;
  };
  userRating?: {
    competence: { star: number; comment: string };
    punctuality: { star: number; comment: string };
    behavior: { star: number; comment: string };
  };
  phone?: string;
  credit?: number | null;
  role: string;
  stripeAccountId: string;
  isStripeOnboarded: boolean;
  fine: number;
  uniqueId: string;
  createdAt: string;
  updatedAt: string;
  age?: string;
  gender?: string;
  name?: string;
  nationality?: string;
}

interface ChatListProps {
  selectedChatId?: string;
  onChatSelect: (chat: Chat) => void;
  onNewChat: (chat: Chat) => void;
}

export function ChatList({
  selectedChatId,
  onChatSelect,
  onNewChat,
}: ChatListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfiles, setShowProfiles] = useState(false);
  const { data: session } = useSession();
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Fetch chats
  const { 
    data: chatsData, 
    isLoading: isChatsLoading,
    refetch: refetchChats 
  } = useQuery({
    queryKey: ["chats"],
    queryFn: () => chatApi.getChatList(),
    select: (data) => data.data.data,
    refetchInterval: 30000,
  });

  // Fetch all user profiles
  const { 
    data: profilesData, 
    isLoading: isProfilesLoading, 
    error: profilesError 
  } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: () => employeeApi.getAll(),
    select: (data) => {
      console.log("employeeApi.getAll response:", data);
      return Array.isArray(data?.data?.data) ? data.data.data : [];
    },
    enabled: showProfiles,
  });

  const allChats = [
    ...(chatsData?.activeChats || []),
    ...(chatsData?.nonActiveChats || []),
  ];

  const filteredChats = allChats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter profiles based on search query
  const filteredProfiles = profilesData?.filter((profile: UserProfile) => {
    if (!searchQuery.trim()) return true;
    
    const searchLower = searchQuery.toLowerCase().trim();
    const username = profile.username?.toLowerCase() || "";
    const name = profile.name?.toLowerCase() || "";
    const email = profile.email?.toLowerCase() || "";
    
    return username.includes(searchLower) || 
           name.includes(searchLower) || 
           email.includes(searchLower);
  }) || [];

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString("it-IT", { weekday: "short" });
    } else {
      return date.toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
      });
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Show profiles dropdown when user starts typing
    if (value.trim() && !showProfiles) {
      setShowProfiles(true);
    } else if (!value.trim()) {
      setShowProfiles(false);
    }
  };

  const handleSearchFocus = () => {
    if (searchQuery.trim()) {
      setShowProfiles(true);
    }
  };

  const handleProfileSelect = async (userId: string) => {
    try {
      // Create a new chat with the selected user
      const response = await chatApi.createChat({ participantId: userId });
      const newChat = response.data.data;
      
      setShowProfiles(false);
      setSearchQuery("");
      
      // Pass the created chat to the parent component
      onNewChat(newChat);
      
      // Refetch chats to update the list
      refetchChats();
    } catch (error) {
      console.error("Error creating chat:", error);
      // Handle error (you might want to show a toast notification)
    }
  };

  const handleNewChatClick = () => {
    setShowProfiles(true);
    setSearchQuery("");
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
      setShowProfiles(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (isChatsLoading) {
    return (
      <div className="w-80 bg-[#030E15] backdrop-blur-sm border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-4 border-b border-white/5">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-[#030E15] backdrop-blur-sm border-r border-white/10 flex flex-col">
      <div className="p-4 border-b border-white/10" ref={searchContainerRef}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Messaggi</h2>
          <Button
            size="sm"
            onClick={handleNewChatClick}
            className="bg-[#901450] hover:bg-pink-700 text-white"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Cerca utenti o conversazioni"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
            className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-gray-400"
          />
          {showProfiles && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#030E15] border border-white/10 rounded-md shadow-lg max-h-60 overflow-y-auto z-10">
              {profilesError ? (
                <div className="p-4 text-center text-red-400">
                  <p>Errore nel caricamento degli utenti</p>
                </div>
              ) : isProfilesLoading ? (
                <div className="p-4">
                  <Skeleton className="h-8 w-full mb-2" />
                  <Skeleton className="h-8 w-full mb-2" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : filteredProfiles.length === 0 ? (
                <div className="p-4 text-center text-gray-400">
                  <p>Nessun utente trovato</p>
                </div>
              ) : (
                filteredProfiles.map((profile: UserProfile) => (
                  <div
                    key={profile._id}
                    onClick={() => handleProfileSelect(profile._id)}
                    className="flex items-center p-3 hover:bg-slate-700/50 cursor-pointer border-b border-white/5 last:border-b-0"
                  >
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarImage src={profile.avatar?.url || "/placeholder.svg"} />
                      <AvatarFallback className="bg-[#901450] text-white">
                        {profile.name?.charAt(0)?.toUpperCase() || 
                         profile.username?.charAt(0)?.toUpperCase() || 
                         "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col">
                        <span className="text-white truncate font-medium">
                          {profile.name || profile.username}
                        </span>
                        {profile.name && profile.username && (
                          <span className="text-xs text-gray-400 truncate">
                            @{profile.username}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 truncate mt-1">
                          {profile.email}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 && !searchQuery ? (
          <div className="p-8 text-center text-gray-400">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nessuna conversazione trovata</p>
            <Button 
              onClick={handleNewChatClick}
              className="mt-4 bg-[#901450] hover:bg-pink-700 text-white"
            >
              Inizia una nuova conversazione
            </Button>
          </div>
        ) : filteredChats.length === 0 && searchQuery ? (
          <div className="p-8 text-center text-gray-400">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nessuna conversazione trovata per "{searchQuery}"</p>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isSelected = selectedChatId === chat._id;
            const otherParticipant = chat.participants?.find(
              (p) => p._id !== session?.user?.id
            );

            return (
              <div
                key={chat._id}
                onClick={() => onChatSelect(chat)}
                className={cn(
                  "p-4 border-b border-white/5 cursor-pointer transition-colors hover:bg-slate-700/50",
                  isSelected && "bg-slate-700/70"
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={otherParticipant?.avatar?.url || chat.imageUrl?.url || "/placeholder.svg"}
                      />
                      <AvatarFallback className="bg-[#901450] text-white">
                        {chat.isGroupChat ? (
                          <Users className="h-6 w-6" />
                        ) : (
                          otherParticipant?.name?.charAt(0)?.toUpperCase() || "U"
                        )}
                      </AvatarFallback>
                    </Avatar>
                    {!chat.isGroupChat && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-800" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-white truncate">
                        {chat.title}
                      </h3>
                      {chat.lastMessage && (
                        <span className="text-xs text-gray-400">
                          {formatTime(chat.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    {chat.lastMessage ? (
                      <p className="text-sm text-gray-400 truncate">
                        {chat.lastMessage.isMe ? "Tu: " : ""}
                        {chat.lastMessage.content}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        Nessun messaggio
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    {chat.isGroupChat && (
                      <Badge variant="secondary" className="text-xs">
                        Gruppo
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}