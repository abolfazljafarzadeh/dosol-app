import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { useApp } from '../App';
import { Brain, MessageCircle, Send, Lock, ShoppingBag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const AssistantScreen = () => {
  const { state, navigate } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: question.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentQuestion = question.trim();
    setQuestion('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ask-metis-question', {
        body: { question: currentQuestion }
      });

      if (error) {
        throw error;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.answer,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling Metis API:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'متأسفانه در حال حاضر نمی‌توانم پاسخ دهم. لطفاً دوباره تلاش کنید.',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 pb-20 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-l from-orange-400 to-amber-400 text-white p-6 rounded-b-3xl">
        <h1 className="text-2xl mb-2 flex items-center gap-2">
          <Brain className="w-7 h-7" />
          دستیار هوشمند
        </h1>
        <p className="text-white/90">سوالات موسیقی خود را بپرسید</p>
      </div>

      {/* Content with conditional blur */}
      <div className="flex-1 relative">
        <div className={`flex-1 flex flex-col ${!state.hasActiveSubscription ? 'blur-sm pointer-events-none' : ''}`}>
          {/* Messages Area */}
          <div className="flex-1 p-6">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-400 to-indigo-400 rounded-2xl flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg mb-2">سوال خود را بپرسید</h3>
                <p className="text-gray-600 text-sm mb-6">
                  دستیار هوشمند آماده پاسخ‌گویی به سوالات موسیقی شماست
                </p>
                
                {/* Sample Questions */}
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 mb-3">سوالات نمونه:</p>
                  {[
                    'چطور تکنیک نواختن پیانو را بهبود دهم؟',
                    'بهترین روش تمرین گام‌ها چیست؟',
                    'چگونه ریتم خود را بهتر کنم؟'
                  ].map((sample, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => setQuestion(sample)}
                      className="text-xs mx-1 mb-2"
                    >
                      {sample}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] p-3 rounded-2xl ${
                        message.type === 'user'
                          ? 'bg-gradient-to-br from-orange-400 to-amber-400 text-white'
                          : 'bg-white border border-gray-200 text-gray-800'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.type === 'user' ? 'text-white/70' : 'text-gray-500'
                        }`}>
                          {message.timestamp.toLocaleTimeString('fa-IR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 text-gray-800 max-w-[80%] p-3 rounded-2xl">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                          <span className="text-sm text-gray-600 mr-2">در حال پاسخ‌گویی...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Input Area */}
          <div className="p-6 bg-white border-t border-gray-200">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="سوالت رو بنویس..."
                className="rounded-xl resize-none min-h-[80px]"
                maxLength={500}
              />
              
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {question.length}/500 کاراکتر
                </div>
                <Button
                  type="submit"
                  disabled={!question.trim() || isLoading}
                  className="bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl px-6"
                >
                  <Send className="w-4 h-4 ml-2" />
                  ارسال پرسش
                </Button>
              </div>
            </form>
            
            {/* FAQ Section */}
            <Card className="rounded-2xl shadow-sm mt-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-sm">سوالات متداول</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { q: 'چه مدت در روز باید تمرین کنم؟', a: 'برای تازه‌کارها ۱۵-۳۰ دقیقه روزانه کافی است.' },
                  { q: 'بهترین سن شروع یادگیری موسیقی چیست؟', a: 'هر سنی برای شروع مناسب است، حتی بزرگسالان.' },
                  { q: 'چگونه انگیزه تمرین را حفظ کنم؟', a: 'اهداف کوتاه‌مدت تعریف کنید و پیشرفت‌تان را ثبت کنید.' },
                  { q: 'آیا بدون معلم می‌توانم یاد بگیرم؟', a: 'امکان‌پذیر است، اما راهنمایی معلم پیشرفت را تسریع می‌کند.' }
                ].map((faq, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => setQuestion(faq.q)}
                    className="text-xs text-right w-full p-2 h-auto border-green-300 hover:bg-green-100"
                  >
                    <div className="text-right">
                      <div className="font-medium mb-1 text-black">{faq.q}</div>
                      <div className="text-green-600 text-xs">{faq.a}</div>
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="rounded-2xl shadow-sm mt-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
              <CardHeader>
                <CardTitle className="text-base">نکات پرسش</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-start gap-2 text-sm text-blue-700">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>سوالات مشخص و دقیق بپرسید</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-blue-700">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>سطح مهارت‌تان را ذکر کنید</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-blue-700">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>در صورت امکان مشکل خاص را شرح دهید</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-blue-700">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>از سوالات چندقسمتی پرهیز کنید</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Overlay for non-subscribers */}
        {!state.hasActiveSubscription && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <Card className="rounded-2xl shadow-lg border-0 bg-gradient-to-br from-orange-50 to-amber-50 max-w-sm mx-4">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-orange-200 to-amber-200 rounded-2xl flex items-center justify-center mb-6">
                  <Lock className="w-10 h-10 text-orange-600" />
                </div>
                <h3 className="text-xl mb-4 text-gray-800">دسترسی محدود</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  برای استفاده از دستیار هوشمند و پرسش سوالات موسیقی، نیاز به اشتراک دارید.
                </p>
                <Button
                  onClick={() => navigate('subscription')}
                  className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl h-12 shadow-lg"
                >
                  <ShoppingBag className="w-5 h-5 ml-2" />
                  خرید اشتراک
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssistantScreen;