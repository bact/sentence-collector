import React, { useState } from 'react';
import type { Language } from '../types';

import LanguageSelector from './language-selector';

type Props = {
  allLanguages: Language[]
  onAdd: (language: string) => void
  filterLanguages?: string[]
  pendingLanguages?: boolean
}

export default function AddLanguage({ allLanguages, onAdd, filterLanguages = [], pendingLanguages = false }: Props) {
  const [language, setLanguage] = useState('');
  const [error, setError] = useState('');

  const onLanguageSelect = (language: string) => { setLanguage(language); };

  const onLanguageAdd = async (event: React.MouseEvent) => {
    event.preventDefault();
    setError('');

    try {
      if (!language) {
        throw new Error('Please select a language');
      }

      await onAdd(language);
    } catch (error) {
      setError(`Could not add language: ${error.message}`);
    }

    setLanguage('');
  };

  return (
    <section>
      { error && ( <p className="error-message">{error}</p> ) }

      <LanguageSelector
        selected={language}
        disabled={pendingLanguages}
        languages={allLanguages}
        filters={filterLanguages}
        labelText="Add a language you want to contribute to"
        onChange={onLanguageSelect}
      />
      <button disabled={!!pendingLanguages || !language}
              onClick={onLanguageAdd} className="add-language">Add Language</button>
    </section>
  );
}
