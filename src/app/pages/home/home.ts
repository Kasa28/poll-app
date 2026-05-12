import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SurveyCard } from '../../components/survey-card/survey-card';
import { supabase } from '../../supabase';

type Survey = {
  id: string;
  category: string;
  title: string;
  endDate: string;
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, SurveyCard],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  surveys: Survey[] = [];

  async ngOnInit() {
    const { data } = await supabase
      .from('surveys')
      .select('*')
      .order('created_at', { ascending: false });

    this.surveys = (data || []).map(survey => ({
      id: survey.id,
      category: survey.category,
      title: survey.title,
      endDate: survey.end_date,
    }));
  }
}