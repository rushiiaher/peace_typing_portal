'use client';

import { useState } from 'react';
import { Button, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, Typography, Box, Paper } from '@mui/material';

interface Question {
    id: number;
    text: string;
    options: { id: string; text: string }[];
    correctAnswer: string;
    explanation?: string;
}

interface MCQQuizProps {
    questions: Question[];
    onComplete: (score: number, total: number) => void;
}

export default function MCQQuiz({ questions, onComplete }: MCQQuizProps) {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState('');
    const [showExplanation, setShowExplanation] = useState(false);
    const [score, setScore] = useState(0);
    const [isFinished, setIsFinished] = useState(false);

    const currentQuestion = questions[currentQuestionIndex];

    const handleNext = () => {
        if (selectedAnswer === currentQuestion.correctAnswer) {
            setScore(score + 1);
        }

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setSelectedAnswer('');
            setShowExplanation(false);
        } else {
            setIsFinished(true);
            onComplete(score + (selectedAnswer === currentQuestion.correctAnswer ? 1 : 0), questions.length);
        }
    };

    const handleExplanation = () => {
        setShowExplanation(true);
    };

    if (isFinished) {
        return (
            <Paper elevation={3} className="p-8 text-center max-w-2xl mx-auto">
                <Typography variant="h4" gutterBottom>Quiz Completed</Typography>
                <Typography variant="h2" color="primary" sx={{ my: 4 }}>
                    {score} / {questions.length}
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    Based on your performance, we recommend reviewing {questions.length - score > 0 ? 'some concepts.' : 'advanced topics next!'}
                </Typography>
                <Button variant="contained" sx={{ mt: 4 }} onClick={() => window.location.reload()}>Retry Quiz</Button>
            </Paper>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
                <Typography variant="h6" color="textSecondary">
                    Question {currentQuestionIndex + 1} of {questions.length}
                </Typography>
                <Typography variant="h6" color="primary">
                    Score: {score}
                </Typography>
            </div>

            <Paper elevation={2} className="p-8 bg-white dark:bg-zinc-900">
                <FormControl component="fieldset" fullWidth>
                    <FormLabel component="legend" sx={{ fontSize: '1.25rem', color: 'text.primary', mb: 3 }}>
                        {currentQuestion.text}
                    </FormLabel>
                    <RadioGroup
                        aria-label="quiz"
                        name="quiz"
                        value={selectedAnswer}
                        onChange={(e) => setSelectedAnswer(e.target.value)}
                    >
                        {currentQuestion.options.map((option) => (
                            <FormControlLabel
                                key={option.id}
                                value={option.id}
                                control={<Radio />}
                                label={option.text}
                                sx={{
                                    mb: 1,
                                    p: 1,
                                    borderRadius: 1,
                                    '&:hover': { bgcolor: 'action.hover' },
                                    bgcolor: showExplanation && option.id === currentQuestion.correctAnswer ? 'success.light' : 'transparent'
                                }}
                            />
                        ))}
                    </RadioGroup>
                </FormControl>

                {showExplanation && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                        <Typography variant="body2"><strong>Explanation:</strong> {currentQuestion.explanation}</Typography>
                    </Box>
                )}

                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    {!showExplanation && <Button variant="outlined" onClick={handleExplanation} disabled={!selectedAnswer}>Check Answer</Button>}
                    <Button variant="contained" onClick={handleNext} disabled={!selectedAnswer}>
                        {currentQuestionIndex === questions.length - 1 ? 'Finish' : 'Next Question'}
                    </Button>
                </Box>
            </Paper>
        </div>
    );
}
