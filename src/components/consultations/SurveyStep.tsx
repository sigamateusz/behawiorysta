import { Calendar, Dog, PawPrint } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { TextareaField } from "@/components/consultations/TextareaField";
import { Button } from "@/components/ui/button";
import { BREEDS } from "@/lib/breeds";

export interface SurveyValues {
  dog_name: string;
  breed: string;
  age_years: string;
  age_months: string;
  basic_info: string;
  goals: string;
}

interface SurveyStepProps {
  values: SurveyValues;
  errors: Record<string, string>;
  isActive: boolean;
  onChange: (field: keyof SurveyValues, value: string) => void;
}

export function SurveyStep({ values, errors, isActive, onChange }: SurveyStepProps) {
  return (
    <div className="space-y-4">
      <FormField
        id="dog_name"
        label="Imię psa"
        value={values.dog_name}
        onChange={(value) => {
          onChange("dog_name", value);
        }}
        placeholder="np. Burek"
        error={errors.dog_name}
        icon={<PawPrint className="size-4" />}
      />

      <FormField
        id="breed"
        label="Rasa"
        value={values.breed}
        onChange={(value) => {
          onChange("breed", value);
        }}
        placeholder="np. Labrador retriever"
        error={errors.breed}
        list="breed-list"
        icon={<Dog className="size-4" />}
      />
      <datalist id="breed-list">
        {BREEDS.map((breed) => (
          <option key={breed} value={breed} />
        ))}
      </datalist>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          id="age_years"
          label="Wiek — lata"
          type="number"
          value={values.age_years}
          onChange={(value) => {
            onChange("age_years", value);
          }}
          placeholder="0"
          error={errors.age_years}
          icon={<Calendar className="size-4" />}
        />
        <FormField
          id="age_months"
          label="Wiek — miesiące"
          type="number"
          value={values.age_months}
          onChange={(value) => {
            onChange("age_months", value);
          }}
          placeholder="0"
          error={errors.age_months}
          icon={<Calendar className="size-4" />}
        />
      </div>

      <TextareaField
        id="basic_info"
        label="Podstawowe informacje"
        value={values.basic_info}
        onChange={(value) => {
          onChange("basic_info", value);
        }}
        placeholder="Opowiedz krótko o swoim psie: charakter, warunki życia, historia."
        error={errors.basic_info}
        rows={4}
      />

      <TextareaField
        id="goals"
        label="Nad czym chcesz pracować"
        value={values.goals}
        onChange={(value) => {
          onChange("goals", value);
        }}
        placeholder="Opisz zachowania, które chcesz zmienić (min. 20 znaków)."
        error={errors.goals}
        rows={5}
        minCount={20}
      />

      <Button
        type={isActive ? "submit" : "button"}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
      >
        Dalej: wybierz termin
      </Button>
    </div>
  );
}
