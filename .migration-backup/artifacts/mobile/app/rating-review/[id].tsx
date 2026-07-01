import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator as RNActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useGlobalSearchParams } from 'expo-router';
import { useReviews, useReviewStats, useCreateReview, useMovie, useSeries } from '@/lib/api-hooks';
import apiClient from '@/lib/api';

interface Review {
  id: string;
  name: string;
  avatar: string;
  date: string;
  rating: number;
  text: string;
  likes: number;
  isLiked: boolean;
  showFullText: boolean;
}

export default function RatingReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [userRating, setUserRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  // Determine contentType from search params or default to 'movie'
  const globalParams = useGlobalSearchParams() as Record<string, string | string[] | undefined>;
  const contentType = (typeof globalParams.contentType === 'string' ? globalParams.contentType : 'movie') || 'movie';

  const { data: reviewsData, isLoading: reviewsLoading, isError, refetch } = useReviews(contentType, id);
  const { data: statsData } = useReviewStats(contentType, id);
  const createReview = useCreateReview();
  const { data: movieData } = useMovie(id);
  const { data: seriesData } = useSeries(id);

  const contentData = contentType === 'series' ? seriesData : movieData;
  const contentTitle = contentData?.title || 'Untitled';
  const contentYear = contentData?.releaseYear || contentData?.year || '';
  const dur = typeof contentData?.duration === 'number'
    ? contentData.duration
    : parseInt(String(contentData?.duration || ''), 10);
  const contentDuration = dur && !isNaN(dur)
    ? `${Math.floor(dur / 60)}h ${dur % 60}m`
    : (contentData?.duration || '');

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // M-017: local optimistic like state per review (count + isLiked).
  const [localLikes, setLocalLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({});

  const reviews: Review[] = useMemo(() => {
    const items = Array.isArray(reviewsData) ? reviewsData : reviewsData?.data ?? [];
    return items.map((r: any) => {
      const baseLikes = r.likes || 0;
      const baseIsLiked = r.isLiked || false;
      const local = localLikes[r.id];
      return {
        id: r.id,
        name: r.user?.name || r.userName || 'Anonymous',
        avatar: (r.user?.name || r.userName || 'AN').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
        date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
        rating: r.rating || 0,
        text: r.comment || r.text || '',
        likes: local ? local.count : baseLikes,
        isLiked: local ? local.isLiked : baseIsLiked,
        showFullText: expandedIds.has(r.id),
      };
    });
  }, [reviewsData, expandedIds, localLikes]);

  const handleStarPress = (star: number) => {
    setUserRating(star);
  };

  const toggleShowFullText = (reviewId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(reviewId)) next.delete(reviewId);
      else next.add(reviewId);
      return next;
    });
  };

  const toggleLike = async (reviewId: string) => {
    // M-017: optimistic local toggle; fire-and-forget API call when available.
    const review = reviews.find((r) => r.id === reviewId);
    const prevCount = review?.likes ?? 0;
    const prevIsLiked = review?.isLiked ?? false;
    const nextIsLiked = !prevIsLiked;
    const nextCount = prevCount + (nextIsLiked ? 1 : -1);
    setLocalLikes((prev) => ({
      ...prev,
      [reviewId]: { count: Math.max(0, nextCount), isLiked: nextIsLiked },
    }));
    try {
      if (nextIsLiked) {
        await apiClient.post(`/reviews/${reviewId}/like`);
      } else {
        await apiClient.delete(`/reviews/${reviewId}/like`);
      }
    } catch {
      // rollback on failure
      setLocalLikes((prev) => ({
        ...prev,
        [reviewId]: { count: prevCount, isLiked: prevIsLiked },
      }));
      Alert.alert('Couldn\u2019t update like', 'Please try again.');
    }
  };

  const avgRating = statsData?.averageRating ?? 0;
  const totalReviews = statsData?.totalReviews ?? reviews.length;

  const handleSubmitReview = () => {
    if (userRating === 0 || !id) return;
    createReview.mutate({
      contentType,
      contentId: id,
      rating: userRating,
      comment: reviewText || undefined,
    }, {
      onSuccess: () => {
        setUserRating(0);
        setReviewText('');
      },
    });
  };

  const renderStars = (rating: number, size: number = 16) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={size}
            color={star <= rating ? '#F5C518' : '#6B6B80'}
            style={styles.starIcon}
          />
        ))}
      </View>
    );
  };

  const renderReviewCard = (review: Review) => (
    <View key={review.id} style={styles.reviewCard}>
      {/* Avatar + Name + Date */}
      <View style={styles.reviewHeader}>
        <LinearGradient
          colors={['#7C3AED', '#2563EB']}
          style={styles.reviewAvatar}
        >
          <Text style={styles.reviewAvatarText}>{review.avatar}</Text>
        </LinearGradient>
        <View style={styles.reviewHeaderInfo}>
          <Text style={styles.reviewName}>{review.name}</Text>
          <Text style={styles.reviewDate}>{review.date}</Text>
        </View>
      </View>

      {/* Star Rating */}
      {renderStars(review.rating, 14)}

      {/* Review Text */}
      <Text
        style={styles.reviewText}
        numberOfLines={review.showFullText ? undefined : 3}
      >
        {review.text}
      </Text>

      {!review.showFullText && review.text.length > 120 && (
        <TouchableOpacity
          onPress={() => toggleShowFullText(review.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.showMoreText}>Show More</Text>
        </TouchableOpacity>
      )}

      {review.showFullText && (
        <TouchableOpacity
          onPress={() => toggleShowFullText(review.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.showMoreText}>Show Less</Text>
        </TouchableOpacity>
      )}

      {/* Like Button */}
      <View style={styles.reviewActions}>
        <TouchableOpacity
          style={styles.likeButton}
          activeOpacity={0.7}
          onPress={() => toggleLike(review.id)}
        >
          <Ionicons
            name={review.isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
            size={18}
            color={review.isLiked ? '#7C3AED' : '#6B6B80'}
          />
          <Text
            style={[
              styles.likeCount,
              review.isLiked && styles.likeCountActive,
            ]}
          >
            {review.likes}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.replyButton} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={16} color="#6B6B80" />
          <Text style={styles.replyText}>Reply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (reviewsLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <RNActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="cloud-offline-outline" size={48} color="#6B6B80" />
        <Text style={styles.errorText}>Something went wrong</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#F2F2F7" />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Rating & Review</Text>
          <View style={styles.spacer} />
        </View>

        {/* Movie/Series Info Card */}
        <View style={styles.movieCard}>
          <LinearGradient
            colors={['#7C3AED', '#2563EB']}
            style={styles.movieThumbnail}
          >
            <Text style={styles.movieThumbnailText}>{contentTitle.slice(0, 2).toUpperCase()}</Text>
          </LinearGradient>
          <View style={styles.movieInfo}>
            <Text style={styles.movieTitle}>{contentTitle}</Text>
            <View style={styles.movieMeta}>
              {contentYear ? <Text style={styles.movieMetaText}>{contentYear}</Text> : null}
              {contentYear && contentDuration ? <View style={styles.movieMetaDot} /> : null}
              {contentDuration ? <Text style={styles.movieMetaText}>{contentDuration}</Text> : null}
              <View style={styles.movieMetaDot} />
              <View style={styles.movieMetaRating}>
                <Ionicons name="star" size={12} color="#F5C518" />
                <Text style={styles.movieRatingText}>{avgRating || 'N/A'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Your Rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>Your Rating</Text>
          <View style={styles.userStarsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                activeOpacity={0.7}
                onPress={() => handleStarPress(star)}
              >
                <Ionicons
                  name={star <= userRating ? 'star' : 'star-outline'}
                  size={32}
                  color={star <= userRating ? '#F5C518' : '#6B6B80'}
                  style={styles.userStarIcon}
                />
              </TouchableOpacity>
            ))}
          </View>
          {userRating > 0 && (
            <Text style={styles.ratingLabel}>
              {userRating === 1 && 'Poor'}
              {userRating === 2 && 'Below Average'}
              {userRating === 3 && 'Average'}
              {userRating === 4 && 'Good'}
              {userRating === 5 && 'Excellent'}
            </Text>
          )}
        </View>

        {/* Write a Review */}
        <View style={styles.writeReviewSection}>
          <Text style={styles.sectionTitle}>Write a Review</Text>
          <TextInput
            style={styles.reviewInput}
            placeholder="Share your thoughts about this movie..."
            placeholderTextColor="#6B6B80"
            multiline
            maxLength={1000}
            value={reviewText}
            onChangeText={setReviewText}
          />
          <Text style={styles.charCount}>{reviewText.length}/1000</Text>
        </View>

        {/* Top Reviews */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.sectionTitle}>Top Reviews</Text>
            <Text style={styles.reviewCountText}>{totalReviews} reviews</Text>
          </View>

          {reviews.map(renderReviewCard)}
        </View>

        {/* Bottom spacing for fixed button */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Fixed Submit Button */}
      <View style={styles.submitButtonContainer}>
        <TouchableOpacity activeOpacity={0.8} disabled={userRating === 0 || createReview.isPending} onPress={handleSubmitReview}>
          <LinearGradient
            colors={['#7C3AED', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.submitButton,
              userRating === 0 && styles.submitButtonDisabled,
            ]}
          >
            <Text style={styles.submitButtonText}>
              {createReview.isPending ? 'Submitting...' : userRating > 0 ? 'Submit Review' : 'Rate to Submit'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070F',
  },
  scrollContent: {
    paddingBottom: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#121A2F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#F2F2F7',
    textAlign: 'center',
  },
  spacer: {
    width: 42,
  },
  movieCard: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: '#121A2F',
    borderRadius: 18,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  movieThumbnail: {
    width: 56,
    height: 78,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  movieThumbnailText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F2F2F7',
  },
  movieInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  movieTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F2F2F7',
  },
  movieMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  movieMetaText: {
    fontSize: 13,
    color: '#B3B8C8',
    fontWeight: '500',
  },
  movieMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#6B6B80',
  },
  movieMetaRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  movieRatingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F5C518',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F2F2F7',
    marginBottom: 14,
  },
  ratingSection: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  userStarsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  userStarIcon: {
    // spacing handled by gap
  },
  ratingLabel: {
    fontSize: 15,
    color: '#F5C518',
    fontWeight: '600',
    marginTop: 10,
  },
  writeReviewSection: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  reviewInput: {
    backgroundColor: '#1C1C2A',
    borderRadius: 14,
    padding: 16,
    fontSize: 14,
    color: '#F2F2F7',
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  charCount: {
    fontSize: 12,
    color: '#6B6B80',
    textAlign: 'right',
    marginTop: 6,
  },
  reviewsSection: {
    paddingHorizontal: 24,
    marginTop: 28,
  },
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  reviewCountText: {
    fontSize: 14,
    color: '#6B6B80',
    fontWeight: '500',
  },
  reviewCard: {
    backgroundColor: '#121A2F',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  reviewAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F2F2F7',
  },
  reviewHeaderInfo: {
    flex: 1,
  },
  reviewName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F2F2F7',
  },
  reviewDate: {
    fontSize: 12,
    color: '#6B6B80',
    marginTop: 1,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 10,
  },
  starIcon: {
    // spacing handled by gap
  },
  reviewText: {
    fontSize: 14,
    color: '#B3B8C8',
    lineHeight: 21,
  },
  showMoreText: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '600',
    marginTop: 6,
  },
  reviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeCount: {
    fontSize: 14,
    color: '#6B6B80',
    fontWeight: '500',
  },
  likeCountActive: {
    color: '#7C3AED',
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  replyText: {
    fontSize: 14,
    color: '#6B6B80',
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 100,
  },
  submitButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingTop: 12,
    backgroundColor: 'rgba(5,7,15,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  submitButton: {
    width: '100%',
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F2F2F7',
    letterSpacing: 0.3,
  },

  // Error
  errorText: {
    fontSize: 15,
    color: '#B3B8C8',
    marginTop: 12,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});