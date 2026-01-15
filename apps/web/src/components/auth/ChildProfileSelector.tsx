import React from 'react';
import { useSurrealAuth, ChildProfile } from '../../hooks/useSurrealAuth';

export const ChildProfileSelector: React.FC = () => {
  const { user, childProfiles, isParent, isChild, switchToChild, switchToParent } = useSurrealAuth();

  const formatAgeGroup = (ageGroup: string): string => {
    switch (ageGroup) {
      case 'ages6to9':
        return 'Ages 6-9';
      case 'ages10to13':
        return 'Ages 10-13';
      case 'ages14to16':
        return 'Ages 14-16';
      default:
        return ageGroup;
    }
  };

  const formatPrivacyLevel = (privacyLevel: string): string => {
    switch (privacyLevel) {
      case 'strict':
        return 'Strict Privacy';
      case 'standard':
        return 'Standard Privacy';
      case 'relaxed':
        return 'Relaxed Privacy';
      default:
        return privacyLevel;
    }
  };

  const formatContentFilters = (filters: string[]): string => {
    return filters.map(filter => {
      switch (filter) {
        case 'educational_only':
          return 'Educational Only';
        case 'age_appropriate':
          return 'Age Appropriate';
        case 'no_social_media':
          return 'No Social Media';
        default:
          return filter.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    }).join(', ');
  };

  const handleSwitchToChild = (childProfile: ChildProfile) => {
    const result = switchToChild(childProfile);
    if (!result.success) {
      console.error('Failed to switch to child profile:', result.error);
    }
  };

  const handleSwitchToParent = () => {
    const result = switchToParent();
    if (!result.success) {
      console.error('Failed to switch to parent account:', result.error);
    }
  };

  // Show current child profile if user is a child
  if (isChild && user?.childProfile) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Currently Logged In As
        </h3>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xl font-bold text-blue-900">
              {user.childProfile.child_name}
            </h4>
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
              {formatAgeGroup(user.childProfile.age_group)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-gray-600">Screen Time Limit</p>
              <p className="font-medium text-gray-900">
                {user.childProfile.parental_controls.screen_time_limit} min/day
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Privacy Level</p>
              <p className="font-medium text-gray-900">
                {formatPrivacyLevel(user.childProfile.privacy_level)}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600">Content Filters</p>
              <p className="font-medium text-gray-900">
                {formatContentFilters(user.childProfile.parental_controls.content_filters)}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSwitchToParent}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          Switch to Parent Account
        </button>
      </div>
    );
  }

  // Show all child profiles if user is a parent
  if (isParent) {
    if (childProfiles.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Child Profiles
          </h3>
          <div className="text-gray-500 mb-4">
            <p className="mb-2">No child profiles found.</p>
            <p>Create your first child profile to get started!</p>
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
            Add Child Profile
          </button>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Select Child Profile
        </h3>

        <div className="space-y-4">
          {childProfiles.map((child) => (
            <div
              key={child.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-900">
                  {child.child_name}
                </h4>
                <div className="flex items-center space-x-2">
                  <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-sm">
                    {formatAgeGroup(child.age_group)}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-sm ${
                    child.privacy_level === 'strict'
                      ? 'bg-red-100 text-red-800'
                      : child.privacy_level === 'standard'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {formatPrivacyLevel(child.privacy_level)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Screen Time</p>
                  <p className="font-medium text-gray-900">
                    {child.parental_controls.screen_time_limit} min/day
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Communication</p>
                  <p className={`font-medium ${
                    child.parental_controls.communication_allowed
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {child.parental_controls.communication_allowed ? 'Allowed' : 'Restricted'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Content Filters</p>
                  <p className="font-medium text-gray-900 text-xs">
                    {formatContentFilters(child.parental_controls.content_filters)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleSwitchToChild(child)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Switch to {child.child_name}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <button className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
            Add New Child Profile
          </button>
        </div>
      </div>
    );
  }

  // Fallback for unauthenticated or invalid state
  return (
    <div className="bg-white rounded-lg shadow-md p-6 text-center">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Child Profiles
      </h3>
      <p className="text-gray-500">
        Please log in to view child profiles.
      </p>
    </div>
  );
};