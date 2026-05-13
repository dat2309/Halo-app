export type ReactionDto = {
  _id: string;
  type: string;
  userId: string;
  createdAt: string;
};

export type CommentDto = {
  _id: string;
  content: string;
  postId: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
};

export type PostDto = {
  _id: string;
  type: 'image' | 'video';
  mediaUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  visibility?: 'public' | 'private';
  createdAt: string;
  updatedAt: string;
  userId: {
    _id: string;
    name: string;
    avatar?: string;
  };
  reactions: ReactionDto[];
  comments: CommentDto[];
  reactionCount: number;
  commentCount: number;
};
