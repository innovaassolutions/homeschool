import React, { useState, useEffect } from 'react';
import { useSurrealAuth } from '../../hooks/useSurrealAuth';

interface FamilyRegistrationProps {
  onSuccess: () => void;
}

interface FormData {
  parentName: string;
  parentEmail: string;
  password: string;
  confirmPassword: string;
  coppaConsent: boolean;
  privacySettings: {
    data_collection: boolean;
    analytics_sharing: boolean;
    marketing_emails: boolean;
    research_participation: boolean;
  };
}

interface FormErrors {
  parentName?: string;
  parentEmail?: string;
  password?: string;
  confirmPassword?: string;
  coppaConsent?: string;
}

export const FamilyRegistration: React.FC<FamilyRegistrationProps> = ({ onSuccess }) => {
  const { registerFamily, isLoading, error, clearError } = useSurrealAuth();

  const [formData, setFormData] = useState<FormData>({
    parentName: '',
    parentEmail: '',
    password: '',
    confirmPassword: '',
    coppaConsent: false,
    privacySettings: {
      data_collection: true,
      analytics_sharing: false,
      marketing_emails: false,
      research_participation: false,
    },
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);

  // Clear API error when form is modified
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [formData, clearError, error]);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    // Parent name validation
    if (!formData.parentName.trim()) {
      errors.parentName = 'Parent name is required';
    }

    // Email validation
    if (!formData.parentEmail.trim()) {
      errors.parentEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.parentEmail)) {
      errors.parentEmail = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    } else if (!/(?=.*[A-Za-z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain at least one letter and one number';
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // COPPA consent validation
    if (!formData.coppaConsent) {
      errors.coppaConsent = 'You must provide COPPA consent to register';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear field-specific error when user starts typing
    if (formErrors[field as keyof FormErrors]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const handlePrivacySettingChange = (setting: keyof FormData['privacySettings'], value: boolean) => {
    setFormData(prev => ({
      ...prev,
      privacySettings: {
        ...prev.privacySettings,
        [setting]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const result = await registerFamily({
      parentName: formData.parentName,
      parentEmail: formData.parentEmail,
      password: formData.password,
      coppaConsent: formData.coppaConsent,
      coppaConsentVersion: '1.0',
      privacySettings: formData.privacySettings,
    });

    if (result.success) {
      onSuccess();
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
        Create Family Account
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Parent Name */}
        <div>
          <label htmlFor="parentName" className="block text-sm font-medium text-gray-700 mb-1">
            Parent Name *
          </label>
          <input
            type="text"
            id="parentName"
            value={formData.parentName}
            onChange={(e) => handleInputChange('parentName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              formErrors.parentName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your full name"
          />
          {formErrors.parentName && (
            <p className="text-red-500 text-sm mt-1">{formErrors.parentName}</p>
          )}
        </div>

        {/* Parent Email */}
        <div>
          <label htmlFor="parentEmail" className="block text-sm font-medium text-gray-700 mb-1">
            Parent Email *
          </label>
          <input
            type="email"
            id="parentEmail"
            value={formData.parentEmail}
            onChange={(e) => handleInputChange('parentEmail', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              formErrors.parentEmail ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your email address"
          />
          {formErrors.parentEmail && (
            <p className="text-red-500 text-sm mt-1">{formErrors.parentEmail}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password *
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 ${
                formErrors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Create a secure password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          {formErrors.password && (
            <p className="text-red-500 text-sm mt-1">{formErrors.password}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password *
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            id="confirmPassword"
            value={formData.confirmPassword}
            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              formErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Confirm your password"
          />
          {formErrors.confirmPassword && (
            <p className="text-red-500 text-sm mt-1">{formErrors.confirmPassword}</p>
          )}
        </div>

        {/* COPPA Consent */}
        <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-900 mb-3">COPPA Consent Required</h3>
          <div className="text-sm text-gray-600 mb-3">
            <p>
              The Children's Online Privacy Protection Act (COPPA) requires parental consent for
              collecting information from children under 13. By creating this account, you confirm
              you are the parent or legal guardian and consent to COPPA compliance for educational purposes.
            </p>
          </div>
          <div className="flex items-start">
            <input
              type="checkbox"
              id="coppaConsent"
              checked={formData.coppaConsent}
              onChange={(e) => handleInputChange('coppaConsent', e.target.checked)}
              className={`mt-1 mr-2 ${formErrors.coppaConsent ? 'border-red-500' : ''}`}
            />
            <label htmlFor="coppaConsent" className="text-sm text-gray-700">
              I acknowledge that I am the parent or legal guardian and provide consent for
              child information processing under COPPA guidelines *
            </label>
          </div>
          {formErrors.coppaConsent && (
            <p className="text-red-500 text-sm mt-1">{formErrors.coppaConsent}</p>
          )}
        </div>

        {/* Privacy Settings */}
        <div className="border border-gray-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Privacy Settings</h3>
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="dataCollection"
                checked={formData.privacySettings.data_collection}
                onChange={(e) => handlePrivacySettingChange('data_collection', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="dataCollection" className="text-sm text-gray-700">
                Allow data collection for educational improvement (Required)
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="analyticsSharing"
                checked={formData.privacySettings.analytics_sharing}
                onChange={(e) => handlePrivacySettingChange('analytics_sharing', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="analyticsSharing" className="text-sm text-gray-700">
                Share anonymized analytics for research
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="marketingEmails"
                checked={formData.privacySettings.marketing_emails}
                onChange={(e) => handlePrivacySettingChange('marketing_emails', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="marketingEmails" className="text-sm text-gray-700">
                Receive marketing emails about new features
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="researchParticipation"
                checked={formData.privacySettings.research_participation}
                onChange={(e) => handlePrivacySettingChange('research_participation', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="researchParticipation" className="text-sm text-gray-700">
                Participate in educational research studies
              </label>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-2 px-4 rounded-md font-medium text-white ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
          }`}
        >
          {isLoading ? 'Creating Account...' : 'Create Family Account'}
        </button>
      </form>

      <div className="mt-4 text-center text-sm text-gray-600">
        <p>
          By creating an account, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};