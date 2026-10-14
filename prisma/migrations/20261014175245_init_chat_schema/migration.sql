-- CreateIndex
CREATE INDEX "idx_conversations_student" ON "conversations"("student_id");

-- CreateIndex
CREATE INDEX "idx_conversations_tutor" ON "conversations"("tutor_id");

-- CreateIndex
CREATE INDEX "idx_conversations_booking" ON "conversations"("booking_id");

-- CreateIndex
CREATE INDEX "idx_messages_conversation_created_at" ON "messages"("conversation_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_messages_sender" ON "messages"("sender_id");
