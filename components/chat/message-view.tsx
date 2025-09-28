"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Smile, Paperclip, Users, Phone, Video } from "lucide-react";
import { chatApi, type Chat, type Message } from "@/lib/chat-api";
import { socketManager } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface MessageViewProps {
  chat: Chat;
}

export function MessageView({ chat }: MessageViewProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", chat._id],
    queryFn: () => chatApi.getMessages(chat._id),
    select: (data) => data.data.data,
    enabled: !!chat._id,
  });

  const sendMessageMutation = useMutation({
    mutationFn: chatApi.sendMessage,
    onSuccess: (data) => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["messages", chat._id] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
    onError: () => {
      toast.error("Errore nell'invio del messaggio");
    },
  });

  // Socket connection and message listening
  useEffect(() => {
    if (!session?.user?.id) return;

    const socket = socketManager.connect(session.user.id);

    const handleNewMessage = (newMessage: Message) => {
      if (newMessage.chatId === chat._id) {
        queryClient.setQueryData(["messages", chat._id], (oldData: any) => {
          if (!oldData) return { data: { data: [newMessage] } };
          return {
            ...oldData,
            data: {
              ...oldData.data,
              data: [newMessage, ...oldData.data.data],
            },
          };
        });
        queryClient.invalidateQueries({ queryKey: ["chats"] });
      }
    };

    socket?.on("newMessage", handleNewMessage);

    return () => {
      socket?.off("newMessage", handleNewMessage);
    };
  }, [chat._id, session?.user?.id, queryClient]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    sendMessageMutation.mutate({
      chatId: chat._id,
      content: message.trim(),
    });
  };

  const formatMessageTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const otherParticipant = chat.participants.find(
    (p) => p._id !== session?.user?.id
  );

  return (
    <div className="flex-1 flex flex-col bg-[#32071c]">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-[#030E15]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={otherParticipant?.avatar?.url || "/placeholder.svg"}
              />
              <AvatarFallback className="bg-[#901450] text-white">
                {chat.isGroupChat ? (
                  <Users className="h-5 w-5" />
                ) : (
                  otherParticipant?.name?.charAt(0)?.toUpperCase() || "U"
                )}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-white">{chat.title}</h3>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  i % 2 === 0 ? "justify-start" : "justify-end"
                )}
              >
                <div
                  className={cn(
                    "flex items-end space-x-2 max-w-xs",
                    i % 2 === 0
                      ? "flex-row"
                      : "flex-row-reverse space-x-reverse"
                  )}
                >
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-10 w-48 rounded-2xl" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : messages && messages.length > 0 ? (
          messages
            .slice()
            .reverse()
            .map((msg) => (
              <div
                key={msg._id}
                className={cn(
                  "flex items-end space-x-2 max-w-xs",
                  msg.isMe
                    ? "ml-auto flex-row-reverse space-x-reverse"
                    : "mr-auto"
                )}
              >
                {!msg.isMe && (
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={msg.sender.avatar?.url || "/placeholder.svg"}
                    />
                    <AvatarFallback className="bg-gray-600 text-white text-xs">
                      {msg.sender.name?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                )}

                <div className="space-y-1">
                  <div
                    className={cn(
                      "px-4 py-2 rounded-2xl",
                      msg.isMe
                        ? "bg-[#901450] text-white rounded-br-md"
                        : "bg-[#4E4E4E] text-white rounded-bl-md"
                    )}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  <p
                    className={cn(
                      "text-xs text-gray-400",
                      msg.isMe ? "text-right" : "text-left"
                    )}
                  >
                    {formatMessageTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            ))
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Inizia una conversazione</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-white/10 bg-[#030E15]">
        <form
          onSubmit={handleSendMessage}
          className="flex items-center space-x-2"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <div className="flex-1 relative">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Scrivi un messaggio..."
              className="bg-slate-700 border-slate-600 text-white placeholder-gray-400 pr-10"
              disabled={sendMessageMutation.isPending}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <Smile className="h-4 w-4" />
            </Button>
          </div>

          <Button
            type="submit"
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="bg-[#901450] hover:bg-pink-700 text-white"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
